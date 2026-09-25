/**
 * Experiment E1 — confirms HT1 / HR1
 * Hypothesis: two concurrent rotate() calls with the same token trigger
 * TokenReuseDetected on the second call, which calls revokeFamily(), leaving
 * isFamilyRevoked() === true afterwards — even though both calls were legitimate.
 *
 * PASS = hypothesis confirmed.  FAIL = hypothesis refuted.
 */
import { describe, it, expect } from "vitest";
import { openDb } from "../../src/db/connection.js";
import { seed } from "../../src/db/seed.js";
import { makeTokenService, InvalidToken, TokenReuseDetected } from "../../src/services/tokenService.js";
import { makeUserRepo } from "../../src/db/userRepo.js";

function setup() {
  const db = openDb(":memory:");
  seed(db);
  return db;
}

describe("E1: concurrent rotate() with same token erroneously revokes family", () => {
  it("after two concurrent rotate() calls with the same token, isFamilyRevoked returns true", async () => {
    const db = setup();
    const svc = makeTokenService(db);
    const users = makeUserRepo(db);

    const user = users.findByEmail("alice@shoply.test")!;
    expect(user).toBeDefined();

    // Issue tokens for login
    const { refresh: rt } = await svc.issueForLogin(user);

    // Find the family id so we can check revocation later
    const row = db
      .prepare<[], { family_id: string }>(
        "SELECT family_id FROM refresh_tokens ORDER BY created_at DESC LIMIT 1"
      )
      .get();
    const familyId = row!.family_id;

    // Two concurrent rotate() calls with the SAME refresh token
    const results = await Promise.allSettled([
      svc.rotate(rt),
      svc.rotate(rt),
    ]);

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    // At least one must succeed
    expect(succeeded.length).toBeGreaterThanOrEqual(1);
    // At least one will fail
    expect(failed.length).toBeGreaterThanOrEqual(1);

    // The failing call should have thrown TokenReuseDetected (not InvalidToken)
    const tokenReuseErrors = failed.filter(
      (r) => r.reason instanceof TokenReuseDetected
    );
    expect(tokenReuseErrors.length).toBeGreaterThanOrEqual(1);

    // After both settle, the family must be revoked — HT1/HR1 confirmed
    const isFamilyRevoked = svc.repo.isFamilyRevoked(familyId);
    expect(isFamilyRevoked).toBe(true); // <-- THIS is what proves the bug
  });
});
