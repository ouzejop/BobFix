/**
 * Experiment E2 — confirms HR2
 * Hypothesis: after two concurrent rotate() calls with the same token,
 * the new token inserted by the winning request is swept by revokeFamily()
 * (its second UPDATE targets all revoked_at IS NULL rows in the family).
 * After both settle, zero active (non-revoked) refresh tokens remain.
 *
 * PASS = hypothesis confirmed.  FAIL = hypothesis refuted.
 */
import { describe, it, expect } from "vitest";
import { openDb } from "../../src/db/connection.js";
import { seed } from "../../src/db/seed.js";
import { makeTokenService } from "../../src/services/tokenService.js";
import { makeUserRepo } from "../../src/db/userRepo.js";

function setup() {
  const db = openDb(":memory:");
  seed(db);
  return db;
}

describe("E2: revokeFamily() sweeps the newly inserted token from the winning request", () => {
  it("after concurrent rotate(), zero active refresh tokens remain in the family", async () => {
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

    // Run two concurrent rotations with the same rt
    await Promise.allSettled([svc.rotate(rt), svc.rotate(rt)]);

    // Count active (non-revoked) tokens in the family after both settle
    const activeCount = db
      .prepare<[string], { cnt: number }>(
        "SELECT COUNT(*) AS cnt FROM refresh_tokens WHERE family_id = ? AND revoked_at IS NULL"
      )
      .get(familyId)!.cnt;

    // If HR2 is true, the winning request's new token was also revoked → count is 0
    expect(activeCount).toBe(0); // <-- THIS is what proves the new token is swept
  });
});
