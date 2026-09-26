# Attempt 1 Reflection

## 🔍 FAILING ASSERTION & OBSERVATION

- **Assertion**: `expect(meRes.status).toBe(200)` at line 60 of the repro test.
- **Expected**: 200 (winner's access token valid after concurrent refresh)
- **Actual**: 401 (family is still revoked, so /me rejects the token)

The `tryClaimToken` approach was supposed to prevent the losing concurrent request from ever reaching `revokeFamily()`. But the test still fails — meaning `revokeFamily()` is still being called.

## 💡 FLAWED ASSUMPTION

My fix assumed Node.js single-threaded event loop means ONLY ONE `findByHash()` call can observe `revoked_at = null` at a time. **WRONG.** Both calls are synchronous (SQLite `db.prepare().get()` is synchronous, not async), and in Node.js, within a single event loop tick, `Promise.all([req1, req2])` schedules both HTTP request handlers — but each handler is async. The two async handlers interleave at `await` boundaries.

The critical interleave:
1. Tab1 calls `findByHash()` → `row.revoked_at = null` ← synchronous, returns immediately
2. **Node yields to Tab2** (at the `const row =` assignment, before `if (row.revoked_at)` check? No.)
3. Actually: `findByHash` is synchronous. Both requests' synchronous paths up to `repo.tryClaimToken(row.id)` run without yielding. But `Promise.all` queues them both as microtasks...

**The real issue**: Both requests enter `rotate()`, both call `findByHash()` **synchronously**, both get `row.revoked_at = null`. Both call `tryClaimToken(row.id)` with the **same** `row.id`. Because `tryClaimToken` uses `UPDATE ... WHERE revoked_at IS NULL`, only ONE will get `changes === 1`. The loser gets `changes === 0` and throws `InvalidToken`. Good.

But wait — does this mean my fix SHOULD work? Let me think again...

Oh. The issue is that `row.revoked_at` in the **initial** `findByHash` snapshot for BOTH requests is `null`. After my fix:
- Tab1: `findByHash` → null → passes check → `tryClaimToken` → **claims** (returns true) → inserts fresh token → 200
- Tab2: `findByHash` → null (same snapshot from concurrent read) → passes check → `tryClaimToken` → **fails** (returns false, changes=0) → throws `InvalidToken` → 401

This is exactly what should happen. `revokeFamily()` is NOT called. So the family should NOT be revoked.

**The remaining question**: Does `isFamilyRevoked` STILL return `true` for the winner's family?

The winner inserts a new token with `repo.insert(...)`. But the `row.family_id` is used. The `token_families` table — was it ever revoked?

In my fix, `revokeFamily()` is only called when `row.revoked_at` is already set at the **initial** `findByHash()` read. In the concurrent case, both reads see `revoked_at = null`. So `revokeFamily()` is NEVER called. The family remains valid. `isFamilyRevoked` returns `false`. The /me request should pass.

**SO WHY IS IT STILL FAILING?**

The interleave might be different from what I assumed. Both requests are handled by the same Node.js event loop. Let me think about the actual interleave point:

Both requests start handling. The `rotate()` function has `await signAccessToken(...)` and `await users.findById(...)`. These are the `await` boundaries.

Actual execution:
1. Tab1: `findByHash` (sync) → `row = {revoked_at: null}` 
2. Tab1: `tryClaimToken` (sync) → UPDATE → changes=1 → **claimed**
3. Tab1: `await users.findById(...)` → **YIELDS to event loop**
4. Tab2: `findByHash` (sync) → same token hash → reads row → `revoked_at` IS NOW SET (Tab1 wrote it) → enters `if (row.revoked_at)` branch → calls `revokeFamily()` → throws `TokenReuseDetected`

**THIS IS THE ACTUAL BUG.** Tab2 reads the row AFTER Tab1's `tryClaimToken` has committed, so it sees `revoked_at` set. It enters the genuine-reuse branch and calls `revokeFamily()`, which sweeps the family before Tab1 finishes inserting the new token.

My fix was correct in adding `tryClaimToken` but I still left the `row.revoked_at` branch calling `revokeFamily()`. The problem is that `row.revoked_at` being set could mean EITHER:
a) Genuine stale-token reuse (attacker replaying an old token)
b) A concurrent legitimate request already claimed the token (won the race)

The `revokeFamily()` path CANNOT distinguish between these two cases. 

## 🏛️ ARCHITECTURAL DOMAIN PATTERN

**RFC 6819 + OAuth 2.0 Refresh Token Rotation with Grace Window / Concurrent Request Tolerance**

The standard pattern for distinguishing legitimate concurrent refresh races from genuine token theft:

**Option A — Grace Window**: After a token is revoked by rotation, allow a short window (e.g. a few seconds) during which the same token can still be used to retrieve the SUCCESSOR token (not refresh again, but detect "I was superseded"). This is too complex.

**Option B — Successor Token Detection (Atomic with family state)**: When `findByHash` finds a row with `revoked_at` set, check if there is a LIVE (non-revoked) successor token in the same family that was created AFTER this token was revoked. If yes → concurrent rotation won the race legitimately → return `InvalidToken` (NOT revokeFamily). Only revoke the family if the revoked token has NO live successor (genuine stale reuse by an attacker).

**Option C — Remove revokeFamily from the "already-revoked" path entirely, relying solely on tryClaimToken**: If `tryClaimToken` is the atomic gate, then `findByHash` seeing a revoked row means Tab2 lost the race. Just throw `InvalidToken`. The revokeFamily path for genuine reuse detection (RFC security) still applies only when the token is found via `findByHash` with `revoked_at` already set AND there is no live successor. But in practice, the simplest safe fix: never call `revokeFamily` from the "found already-revoked" path; instead, only revoke the family if `tryClaimToken` was called and succeeded but the subsequent insert/read chain detects something wrong.

**Simplest correct fix**: Remove `revokeFamily()` from the `row.revoked_at` branch in `rotate()`. When a token is found already-revoked by a later concurrent request, it means the race was lost — just throw `InvalidToken`. The family stays valid. The winner's fresh token is usable.

**Security consideration**: Does removing `revokeFamily` from the already-revoked path break token theft detection? Yes, it weakens it for the specific scenario of an attacker replaying an already-rotated token. However, the alternative approach — check if a live successor exists in the family — provides the correct security guarantee: if a live successor exists, it's a race; if not, it's theft. This is the correct pattern per RFC 6819.
