import type { BetterDb } from "./connection.js";

export interface RefreshTokenRow {
  id: number;
  family_id: string;
  user_id: number;
  token_hash: string;
  created_at: number;
  expires_at: number;
  revoked_at: number | null;
}

export function makeRefreshTokenRepo(db: BetterDb) {
  const findByHash = (hash: string): RefreshTokenRow | undefined => {
    return db
      .prepare<[string], RefreshTokenRow>(
        "SELECT * FROM refresh_tokens WHERE token_hash = ?"
      )
      .get(hash);
  };

  const insert = (params: {
    familyId: string;
    userId: number;
    hash: string;
    expiresAt: number;
  }): void => {
    db.prepare(
      "INSERT INTO refresh_tokens (family_id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)"
    ).run(params.familyId, params.userId, params.hash, Date.now(), params.expiresAt);
  };

  const revoke = (id: number): void => {
    db.prepare(
      "UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?"
    ).run(Date.now(), id);
  };

  /**
   * Atomically claim the token by setting revoked_at only if it is still NULL.
   * Returns 1 if this caller won the race, 0 if someone else already revoked it.
   */
  const claimRevoke = (id: number): number => {
    const stmt = db.prepare(
      "UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL"
    );
    return (stmt.run(Date.now(), id) as { changes: number }).changes;
  };

  /**
   * Find the single live (unrevoked, unexpired) refresh-token row for a family.
   * Used to detect concurrent re-submission: if a live successor already exists,
   * the caller is a racing tab that lost the insert race, not a token thief.
   */
  const findLiveByFamily = (familyId: string): RefreshTokenRow | undefined => {
    return db
      .prepare<[string, number], RefreshTokenRow>(
        "SELECT * FROM refresh_tokens WHERE family_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
      )
      .get(familyId, Date.now());
  };

  const revokeFamily = (familyId: string): void => {
    db.prepare(
      "UPDATE token_families SET revoked_at = ? WHERE id = ?"
    ).run(Date.now(), familyId);
    db.prepare(
      "UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ? AND revoked_at IS NULL"
    ).run(Date.now(), familyId);
  };

  const isFamilyRevoked = (familyId: string): boolean => {
    const row = db
      .prepare<[string], { revoked_at: number | null }>(
        "SELECT revoked_at FROM token_families WHERE id = ?"
      )
      .get(familyId);
    return row == null || row.revoked_at != null;
  };

  const createFamily = (id: string, userId: number): void => {
    db.prepare(
      "INSERT INTO token_families (id, user_id, created_at) VALUES (?, ?, ?)"
    ).run(id, userId, Date.now());
  };

  return { findByHash, insert, revoke, claimRevoke, findLiveByFamily, revokeFamily, isFamilyRevoked, createFamily };
}

export type RefreshTokenRepo = ReturnType<typeof makeRefreshTokenRepo>;
