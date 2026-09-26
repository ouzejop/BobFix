import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomBytes, createHash } from "crypto";
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_DAYS, JWT_SECRET, CONCURRENT_REFRESH_GRACE_MS } from "../config.js";
import { makeRefreshTokenRepo } from "../db/refreshTokenRepo.js";
import { makeUserRepo, type UserRow } from "../db/userRepo.js";
import type { BetterDb } from "../db/connection.js";

export class InvalidToken extends Error {
  constructor() {
    super("Invalid token");
  }
}

export class TokenReuseDetected extends Error {
  constructor() {
    super("Token reuse detected");
  }
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function newRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

const secretBytes = new TextEncoder().encode(JWT_SECRET);

export async function signAccessToken(user: UserRow, familyId: string): Promise<string> {
  return new SignJWT({ sub: String(user.id), fid: familyId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL)
    .sign(secretBytes);
}

export function makeTokenService(db: BetterDb) {
  const repo = makeRefreshTokenRepo(db);
  const users = makeUserRepo(db);

  const issueForLogin = async (user: UserRow) => {
    const familyId = randomBytes(16).toString("hex");
    repo.createFamily(familyId, user.id);
    const refresh = newRefreshToken();
    const expiresAt = Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
    repo.insert({ familyId, userId: user.id, hash: sha256(refresh), expiresAt });
    const access = await signAccessToken(user, familyId);
    return { access, refresh };
  };

  const rotate = async (oldToken: string) => {
    const row = repo.findByHash(sha256(oldToken));
    if (!row || row.expires_at < Date.now() || repo.isFamilyRevoked(row.family_id)) {
      throw new InvalidToken();
    }
    // Rotated longer ago than the grace window: a stale token is being replayed → theft.
    if (row.revoked_at !== null && Date.now() - row.revoked_at >= CONCURRENT_REFRESH_GRACE_MS) {
      repo.revokeFamily(row.family_id);
      throw new TokenReuseDetected();
    }
    // Rotated within the grace window: a sibling request (another tab) used this token
    // moments ago. Give this request its own pair in the same family — a 401 here makes
    // the client log out. tryClaimToken keeps the first revocation time, so replays
    // cannot extend the window.
    repo.tryClaimToken(row.id);
    const user = await users.findById(row.user_id);
    const access = await signAccessToken(user, row.family_id);
    const refresh = newRefreshToken();
    repo.insert({
      familyId: row.family_id,
      userId: user.id,
      hash: sha256(refresh),
      expiresAt: Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    });
    return { access, refresh };
  };

  return { issueForLogin, rotate, repo };
}

export type TokenService = ReturnType<typeof makeTokenService>;

export async function verifyAccessToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secretBytes, {
    clockTolerance: 5,
  });
  return payload;
}
