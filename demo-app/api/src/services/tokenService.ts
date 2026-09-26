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
    if (row.revoked_at) {
      // Distinguish a concurrent legitimate refresh race from genuine stale-token reuse:
      // If the token was revoked very recently (within the grace window), another request
      // won the race moments ago — return InvalidToken without revoking the family.
      // If it was revoked long ago, it is genuine token theft — revoke the entire family.
      if (Date.now() - row.revoked_at <= CONCURRENT_REFRESH_GRACE_MS) {
        throw new InvalidToken();
      }
      repo.revokeFamily(row.family_id);
      throw new TokenReuseDetected();
    }
    // Atomically claim the token. If another concurrent request already claimed it,
    // treat it as a lost race (InvalidToken), NOT as genuine reuse — do NOT revoke
    // the family, because the winning request's fresh token is still valid.
    const claimed = repo.tryClaimToken(row.id);
    if (!claimed) {
      throw new InvalidToken();
    }
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
