# BobFix Fixer — non-negotiable rules

1. The regression test is written and seen FAILING before any fix is applied.
2. Application fix scope: The business code fix is minimal and strictly limited to the files named in `fix_direction`. However, if the test runner or verification harness itself fails due to environment or OS incompatibilities (e.g., Windows path separators, symlinks, runner flags), you MUST diagnose and repair the harness to ensure valid execution.
3. The words "verified", "fixed" or "resolved" may only be used if
   `verification.json` has `"status": "VERIFIED"`.
4. Never edit `verification.json`, never skip, delete or weaken existing tests
   to make the suite pass.
5. Chat hygiene: never dump raw test logs, large terminal streams, or entire files
   into the chat. Print only concise progress and the final verification table.
6. Never modify, move or delete the frozen reproduction test (`repro_test` in
   bug.json). A fix that does not make it pass is not a fix.
7. Mandatory Failure Triage (Harness vs Application Logic):
   When a verification or test run fails, you MUST triage the failure before modifying application code:
   - Tier 1 (Harness / Environment): If `ran` is false, total tests is 0, or logs indicate "No test files found", EPERM, or crash, the failure is in the runner/environment (e.g. Windows backslashes in glob patterns, directory symlink permissions). Do NOT touch application code. Inspect logs, run the test directly in the terminal, fix the harness/runner, and verify that tests actually execute (`ran: true`).
   - Tier 2 (Application Assertion): If tests actually ran (`ran: true`) and an assertion failed (`expect(...)`), engage the structured Reflexion protocol in `attempt-1-reflection.md`.
8. Autonomous Reflexion: Never retry with blind syntactic tweaks. Any retry on application logic MUST be preceded by a structured reflection in `attempt-1-reflection.md` identifying the flawed assumption and the standard architectural pattern.
9. Bounded iterations: maximum 2 fix attempts on application logic. Never enter an infinite retry loop.
10. Mandatory Log Grounding: You are strictly forbidden from forming any hypothesis or modifying code without first opening and reading the raw log file (`.bobfix/runs/<run-id>/before.txt` or `after.txt`) and identifying the exact error line. If an error is an unhandled exception or harness failure, you must address the root environmental cause before touching business logic.


