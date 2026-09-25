import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { randomBytes, createHash } from "crypto";
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_DAYS, JWT_SECRET } from "../config.js";
import { makeRefreshTokenRepo, type RefreshTokenRow } from "../db/refreshTokenRepo.js";
import { makeUserRepo, type UserRow } from "../db/userRepo.js";
import Database from "better-sqlite3";

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

export function makeTokenService(db: Database.Database) {
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

    // Atomically claim the token AND insert the successor in one synchronous
    // transaction — no await between the two DB writes.  Because Node.js is
    // single-threaded, no other coroutine can observe an intermediate state
    // where the old token is revoked but the new one does not yet exist.
    // claimRevoke uses WHERE revoked_at IS NULL so it returns 0 for both:
    //   (a) prior-rotation stale tokens (already revoked before this call)
    //   (b) concurrent siblings that lost the race just now
    // We distinguish them by checking whether a live successor was inserted
    // recently (within CONCURRENT_GRACE_MS).
    const CONCURRENT_GRACE_MS = 30_000;
    const refresh = newRefreshToken();
    const expiresAt = Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

    const claimAndInsert = db.transaction(() => {
      const claimed = repo.claimRevoke(row.id);
      if (claimed === 0) {
        // Claim failed — check for a live successor to determine race vs. theft.
        return repo.findLiveByFamily(row.family_id) ?? null;
      }
      repo.insert({ familyId: row.family_id, userId: row.user_id, hash: sha256(refresh), expiresAt });
      return null; // null signals "winner"
    });

    const successor: RefreshTokenRow | null = claimAndInsert();

    if (successor !== null) {
      // A live successor exists.  If it was inserted recently, this is a
      // concurrent re-submission (the winner's transaction just committed).
      // Issue fresh tokens so the losing tab also gets a valid session.
      // If the successor is old (outside grace window), a real theft replayed
      // a stale token — revoke the family.
      if (successor.created_at < Date.now() - CONCURRENT_GRACE_MS) {
        repo.revokeFamily(row.family_id);
        throw new TokenReuseDetected();
      }
      const user = await users.findById(row.user_id);
      const access = await signAccessToken(user, successor.family_id);
      const loserRefresh = newRefreshToken();
      repo.insert({
        familyId: successor.family_id,
        userId: row.user_id,
        hash: sha256(loserRefresh),
        expiresAt: Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
      });
      return { access, refresh: loserRefresh };
    }

    if (successor === null && row.revoked_at !== null) {
      // claimRevoke returned 0 AND findLiveByFamily returned nothing —
      // the family has no live tokens left.  This is a stale theft with no
      // active successor; revoke the family for safety.
      repo.revokeFamily(row.family_id);
      throw new TokenReuseDetected();
    }

    // Winner path: async JWT signing after the synchronous DB work.
    const user = await users.findById(row.user_id);
    const access = await signAccessToken(user, row.family_id);
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
