---
name: bobfix-investigate
description: Investigate a bug report across the whole repository with parallel explore subagents, collect structured evidence, compare hypotheses and write an evidence-backed root-cause report under .bobfix/runs/.
---
You are running a BobFix investigation. The goal is a root cause backed by
evidence observed in the repository — not a guess.

<Steps>
<Step>
Create the run folder `.bobfix/runs/<run-id>/` where `<run-id>` is
`YYYYMMDD-HHMM-<short-slug>`. Write `bug.json` with the bug report text,
the current git commit (`git rev-parse HEAD`) and the start time (ISO 8601).
</Step>
<Step>
Map the repository in at most 3 tool calls (top-level tree, package manifests,
test layout). Write `map.json`: the parts of the system (clients, APIs, services, persistence,
integrations, jobs, tests and how they run)
and the entry points relevant to the bug.
</Step>
<Step>
Reproduce first — before any hypothesis. Using ONLY the bug report and the
repository's existing test setup, write ONE reproduction test that drives the
system through its public interface (HTTP endpoint, CLI, UI component, public
function) and asserts the behaviour the user expects. It must not encode any
guess about the cause. Put it in the repo's test folder under a `repro/`
subfolder. Run it: it MUST fail on the current code. If it passes, the bug is not
reproduced: adjust the scenario (not the assertion about user-visible behaviour)
up to 3 times; if it still passes, record that in `bug.json` and continue.
Record in `bug.json`: `repro_test: { path, sha256 }` (`sha256sum <path>`) and the
failing output. This test is frozen: nobody edits it afterwards.
</Step>
<Step>
Choose THREE investigation scopes from `map.json`, following `subagent-briefs.md`,
and record them in `map.json` (name, prefix, paths, why this scope is on the
path of the bug). Then spawn exactly THREE explore subagents IN PARALLEL, in a
single step — one per scope, with the brief in `subagent-briefs.md`.
Do not investigate the scopes yourself before they return.
</Step>
<Step>
When all three return, save each returned JSON block verbatim as
`evidence-<scope-name>.json`.
Each must match `evidence.schema.json`. If a subagent returned invalid JSON,
fix only the formatting, never the content.
</Step>
<Step>
Correlate. List every hypothesis from the three files. For each, mark it
`supported`, `rejected` or `inconclusive`, citing evidence ids (e.g. `B2`, `F1`).
A hypothesis is `supported` only if at least one piece of evidence quotes the
code that causes it. Explain how evidence from different layers chains together.
If a hypothesis can be checked by running an existing test or a short command,
run it and record the output as evidence of kind `execution`.
</Step>
<Step>
Write a DRAFT `root-cause.json` following `report-template.md`: the root cause,
the causal chain across files, confidence, rejected hypotheses with the reason,
and the fix direction (what should change, where — no code).
</Step>
<Step>
Skeptic review — never skip. Spawn ONE explore subagent with the brief in
`skeptic-brief.md`, passing the full draft `root-cause.json` and the paths of
the evidence files. Its job is to break the draft, not to agree with it.
Save its JSON verbatim as `challenges-round-<n>.json`.
</Step>
<Step>
Answer every challenge in `challenges-round-<n>.json`, in `rebuttals-round-<n>.json`.
For each one, FIRST open the quoted lines yourself and check the quote says what
the skeptic claims. Then mark it:
- `refuted` — the quote is wrong, or other code (quote it) proves the claim false;
- `accepted` — the code confirms it; revise the draft accordingly.
Skeptics can be wrong too: never accept a challenge you have not checked in the code.
</Step>
<Step>
Loop — MANDATORY. If round <n> had at least one accepted challenge, you MUST spawn
the skeptic again on the revised draft (round n+1), passing the previous
challenges so it does not repeat them. Only stop when a round has zero accepted
challenges, or after round 3. State in the summary how many rounds ran and why
it stopped.
</Step>
<Step>
Finalise `root-cause.json`. Add a `skeptic` section: rounds run, challenges
raised, accepted, refuted, and what changed in the conclusion because of them.
</Step>
<Step>
Print a short summary to the user: root cause in one sentence, confidence,
affected files, rejected hypotheses, and what the skeptic changed (if anything). End with:
"Switch to BobFix Fixer to apply and verify the fix."
</Step>
</Steps>
