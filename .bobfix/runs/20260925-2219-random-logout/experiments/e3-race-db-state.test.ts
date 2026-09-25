/**
 * Experiment E3 — confirms ordering / timing of the race
 * Checks exactly WHICH error each concurrent request throws, and whether
 * the family record (token_families.revoked_at) is set even though a new
 * individual token row survives with revoked_at IS NULL.
 *
 * PASS if: one throws TokenReuseDetected, family is revoked, but new token row exists.
 */
import { describe, it, expect } from "vitest";
import { openDb } from "../../src/db/connection.js";
import { seed } from "../../src/db/seed.js";
import { makeTokenService, TokenReuseDetected, InvalidToken } from "../../src/services/tokenService.js";
import { makeUserRepo } from "../../src/db/userRepo.js";

function setup() {
  const db = openDb(":memory:");
  seed(db);
  return db;
}

describe("E3: race details — which error is thrown and exact DB state", () => {
  it("second concurrent rotate() throws TokenReuseDetected; family is revoked; new token row exists but is unusable", async () => {
    const db = setup();
    const svc = makeTokenService(db);
    const users = makeUserRepo(db);

    const user = users.findByEmail("alice@shoply.test")!;
    const { refresh: rt } = await svc.issueForLogin(user);

    const familyRow = db
      .prepare<[], { family_id: string }>(
        "SELECT family_id FROM refresh_tokens ORDER BY created_at DESC LIMIT 1"
      )
      .get();
    const familyId = familyRow!.family_id;

    const results = await Promise.allSettled([svc.rotate(rt), svc.rotate(rt)]);

    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    const fulfilled = results.filter((r): r is PromiseFulfilledResult<{ access: string; refresh: string }> => r.status === "fulfilled");

    // Exactly one must succeed, one must fail
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    // The failure must be TokenReuseDetected (not InvalidToken)
    expect(rejected[0].reason).toBeInstanceOf(TokenReuseDetected);

    // The family is revoked in token_families
    const familyRec = db
      .prepare<[string], { revoked_at: number | null }>(
        "SELECT revoked_at FROM token_families WHERE id = ?"
      )
      .get(familyId);
    expect(familyRec!.revoked_at).not.toBeNull(); // family is revoked

    // But the individual new token row from the WINNING request still exists
    const activeTokens = db
      .prepare<[string], { cnt: number }>(
        "SELECT COUNT(*) AS cnt FROM refresh_tokens WHERE family_id = ? AND revoked_at IS NULL"
      )
      .get(familyId)!.cnt;
    // There is 1 active token (the newly issued one from the winning request)
    // but the FAMILY is revoked, so it can never be used
    expect(activeTokens).toBe(1); // token row exists but is trapped by revoked family

    // Confirm: using the new token from the winner is rejected (family is revoked)
    const { refresh: winnerRefresh } = fulfilled[0].value;
    await expect(svc.rotate(winnerRefresh)).rejects.toThrow(InvalidToken);
  });
});
