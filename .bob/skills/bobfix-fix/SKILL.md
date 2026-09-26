---
name: bobfix-fix
description: Apply the fix from a BobFix investigation, with autonomous Reflexion / Self-Debug if the first attempt fails, and mathematically prove the fix with verify.mjs.
---
You are finishing a BobFix run in STRICT SILENT MODE.
You must NEVER output conversational explanations, step-by-step reasoning, or code blocks
in the chat. All thinking, reflection, and debugging are written silently to files under `.bobfix/`.
In the chat, you output ONLY the short status indicators (`[1/3]`, `[2/3]`, `[3/3]`) and the final table.


<Steps>
<Step>
INITIALIZE FIX.
Read the latest `.bobfix/runs/<run-id>/root-cause.json`. Record the current
commit as `base_ref` (`git rev-parse HEAD`) — this is the buggy version.
Refuse to continue if the application directory (`demo-app/`) has uncommitted changes outside the reproduction test.
Read `repro_test` in `bug.json`. If `sha256` is null or missing, compute the SHA-256
hash of the test file immediately and update `bug.json`.
That frozen reproduction test must pass after your fix; you must never modify, move or delete it.
</Step>

<Step>
REGRESSION TEST FIRST & PRE-FLIGHT CHECK.
Write the regression test following `regression_test_idea` (or verify the repro test).
Run it directly in the terminal first (`npx vitest run <path>`) with forward slashes `/`.
Verify that tests actually run (`tests collected > 0`) and fail on the expected assertion.
If the runner crashes or collects 0 tests, diagnose path separators (`/` vs `\`) or environment immediately.
Save the failing output to `.bobfix/runs/<run-id>/before.txt`.
Print in chat: `🧪 [1/3] Test de régression créé (vérifié échouant avant le fix).`
</Step>

<Step>
MINIMAL FIX & COMMIT (Attempt 1).
Apply the smallest code change that addresses the root cause in the affected files.
No refactoring, no unrelated changes.
Save diff to `.bobfix/runs/<run-id>/fix.diff`.
Commit the fix and the test together with a conventional commit message.
Print in chat: `🛠️ [2/3] Correctif appliqué et commité (Tentative 1).`
</Step>

<Step>
VERIFY & AUTONOMOUS REFLEXION (Self-Debug Protocol).
Run the verification script:
`node scripts/verify.mjs --run <run-id> --base <base_ref> --test <regression test path> --app demo-app/api`
It writes `verification.json`.

IF status is VERIFIED:
  Proceed directly to the FINAL REPORT step.

IF status is NOT_VERIFIED:
  Inspect `verification.json` and the test logs (`before.txt`, `after.txt`, `repro-before.txt`).

  PHASE A: HARNESS & ENVIRONMENT TRIAGE (Do this FIRST)
  Check if tests actually executed:
  - Did any test run have `ran: false`, `total: 0`, or logs containing "No test files found", "command not found", or "EPERM"?
  - If YES: this is an ENVIRONMENT / HARNESS failure, NOT an application code bug!
    Do NOT touch application code in `demo-app/`.
    Diagnose the harness/environment failure:
    1. Cross-platform path separators: On Windows, test runners (Vitest, Jest) and glob matchers treat backslashes `\` as escape characters. Test paths passed to the runner CLI must use forward slashes `/`.
    2. Symlink vs Junction: On Windows, directory symlinks require admin rights; directory junctions (`mklink /J`) must be used for temporary worktrees.
    3. Shell spawning: Spawning commands on Windows requires `shell: true` if invoking `npx` or `.cmd` binaries.
    Inspect the raw logs, test the command directly in the terminal, repair `scripts/verify.mjs`, and re-run verification once the harness is functioning.

  PHASE B: APPLICATION LOGIC REFLEXION (Only when tests ran: `ran: true` and assertions failed)
  If the harness executed cleanly but test assertions failed (`expect(...)`):
  1. Write `.bobfix/runs/<run-id>/attempt-1-reflection.md` answering 3 mandatory questions:
     - 🔍 FAILING ASSERTION & OBSERVATION: Which assertion failed in `after.txt` or `suite.txt`? What was the expected vs actual observed state?
     - 💡 FLAWED ASSUMPTION: Why was the candidate fix or the investigator's initial advice fundamentally insufficient (e.g. why simple transactions or locks alone do not solve concurrent sibling requests)?
     - 🏛️ ARCHITECTURAL DOMAIN PATTERN: What established industry pattern / RFC solves this problem (e.g. for OAuth 2.0 refresh token rotation: a concurrent leeway/grace window or atomic claim with live successor detection as recommended by RFC 6819)?
  2. Implement the revised fix adhering to that domain pattern in the affected files.
  3. Save commit: `git commit -am "fix: apply <pattern> resolving <issue>"`
  4. Re-run `node scripts/verify.mjs ...` (Attempt 2).
  Stop strictly after Attempt 2.
</Step>

<Step>
FINAL REPORT (Clean & Concise).
Report to the user using ONLY the values in `verification.json`:
Display a concise summary table:
- Bug reproduced before fix: ✓ / ✗
- Regression test after fix: ✓ / ✗
- Full test suite: ✓ / ✗
- Repro test intact & passing: ✓ / ✗
- Status: **VERIFIED** or **NOT_VERIFIED**
If Reflexion was used, mention the architectural pattern in 1 sentence.
Never dump raw terminal logs or diffs into the chat.
</Step>
</Steps>


