---
name: bobfix-fix
description: Apply the minimal fix from a BobFix root-cause report, add a regression test that reproduces the bug, and prove the fix with the verification script.
---
You are finishing a BobFix run. The investigation is done; your job is to
fix and PROVE the fix.

<Steps>
<Step>
Read the latest `.bobfix/runs/<run-id>/root-cause.json`. Record the current
commit as `base_ref` (`git rev-parse HEAD`) — this is the buggy version.
Refuse to continue if the working tree has uncommitted changes outside `.bobfix/`.
</Step>
<Step>
Write the regression test first, following `regression_test_idea`. Run it
alone. It MUST fail on the current code. If it passes, the test does not
reproduce the bug: rewrite it. Save the failing output to `before.txt`.
</Step>
<Step>
Apply the smallest code change that addresses the root cause, in the files
listed by `fix_direction`. No refactoring, no unrelated changes.
Save the diff to `fix.diff` (`git diff -- . ':!.bobfix'`).
</Step>
<Step>
Commit the fix and the test together with a conventional commit message.
</Step>
<Step>
Run `node scripts/verify.mjs --run <run-id> --base <base_ref> --test <regression test path> --app demo-app/api`.
It writes `verification.json`. Do not edit that file.
</Step>
<Step>
Copy `verification.json` to `verification-attempt-<n>.json` (n starts at 1).
If status is VERIFIED, go to the report step.
If NOT_VERIFIED, treat the failing output as NEW EVIDENCE, not as a nuisance:
- `bug_reproduced_before_fix` false → the test does not reproduce the bug:
  rewrite the test (never the fix) and re-run from the test step.
- regression test or full suite failing after the fix → read the failing
  assertion in `after.txt` / `suite.txt`, explain in `attempt-<n>.md` why the fix
  did not remove the symptom (quote the code path), then revise the fix. You may
  touch files listed in `root_cause.affected_files`, not others. Commit, re-run
  the verification.
Stop after 3 attempts. Never weaken or delete a test to pass.
</Step>
<Step>
Report to the user using ONLY the values in the last `verification.json`:
number of attempts and why each earlier one failed, bug reproduced before fix,
regression test after fix, full suite result, final status. If the final status
is not VERIFIED, say so plainly and stop.
</Step>
</Steps>
