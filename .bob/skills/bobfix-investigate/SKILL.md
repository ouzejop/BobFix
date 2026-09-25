---
name: bobfix-investigate
description: Investigate a bug report with the scientific method — reproduce it with a frozen test, gather hypotheses from parallel explore subagents, then confirm or kill each hypothesis with a small experiment, and write an experiment-backed root-cause report under .bobfix/runs/.
---
You are running a BobFix investigation. Reading code produces hypotheses;
only running code produces conclusions.

<Steps>
<Step>
Create `.bobfix/runs/<run-id>/` (`YYYYMMDD-HHMM-<short-slug>`). Write `bug.json`
with the bug report, `git rev-parse HEAD` and the start time (ISO 8601).
</Step>
<Step>
Map the repository in at most 3 tool calls (tree, manifests, how tests run).
Write `map.json`: the parts of the system and how to run one test file.
</Step>
<Step>
REPRODUCE. Using ONLY the bug report, write ONE test that drives the system through
its public interface (HTTP endpoint, CLI, UI component, public function) and
asserts what the user expects. No guess about the cause.
Symptom first: find in the code what directly PRODUCES the reported symptom (e.g.
which responses make the client log out, show an error, charge twice, drop data).
Replay the WHOLE user scenario — every call the client makes in it, in the way it
makes them (sequential, parallel, retried) — and assert that NONE of them produces
that trigger. A fix that leaves the user-visible symptom in place must fail this
test, even if part of the scenario succeeds. If the layer that shows the symptom
cannot be tested in this repo, test at the next layer down and write in bug.json
which client behaviour you are standing in for. Put it in the test folder
under `repro/`. Run it: it MUST fail. If it passes, change the scenario (never the
user-visible assertion), up to 3 tries. Record in `bug.json`:
`repro_test: { path, sha256 }` (`sha256sum`) and the failing output.
This test is frozen: nobody edits it afterwards.
</Step>
<Step>
HYPOTHESES. Choose 1 to 5 scopes: one per distinct part of the system on the path
from the trigger to the failure (see `subagent-briefs.md`); justify each in
`map.json`. Spawn one explore subagent per scope, ALL IN PARALLEL in a single step.
Save each answer as `evidence-<scope>.json`. Each hypothesis comes with an
experiment idea.
</Step>
<Step>
EXPERIMENTS. For every hypothesis with confidence ≥ 0.3 (at most 5), write the
smallest test that would PASS if the hypothesis is true and FAIL if it is false
(e.g. call the two operations in the suspected order and assert the suspected
state). Put it in the test folder under `experiments/`, run it, and record in
`experiments.json`: hypothesis id, file, command, exit code, key output lines,
verdict `confirmed` / `refuted` / `inconclusive`. Then move the experiment files
into `.bobfix/runs/<run-id>/experiments/` so they never join the test suite.
If an experiment reveals a new trigger or path, you may spawn ONE more explore
subagent on it, then experiment again.
</Step>
<Step>
ROOT CAUSE. Write `root-cause.json` following `report-template.md`. The root cause
must be a hypothesis CONFIRMED by an experiment; each step of the causal chain cites
evidence ids and experiment ids. List refuted hypotheses with the experiment that
killed them. Fix direction: what must change and where, so that the frozen repro
test passes in every trigger the experiments revealed — no code.
</Step>
<Step>
Summarise for the user: repro test (failing), hypotheses tested, confirmed cause,
refuted ones, fix direction. End with:
"Switch to BobFix Fixer to apply and verify the fix."
</Step>
</Steps>
