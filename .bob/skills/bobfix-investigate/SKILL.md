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
test layout). Write `map.json`: layers found (frontend, backend, data, tests)
and the entry points relevant to the bug.
</Step>
<Step>
Spawn exactly THREE explore subagents IN PARALLEL, in a single step — one per
layer: frontend, backend, data. Use the briefs in `subagent-briefs.md`. Pass
each one the bug report and the paths from `map.json`. Do not investigate the
layers yourself before they return.
</Step>
<Step>
When all three return, save each returned JSON block verbatim as
`evidence-frontend.json`, `evidence-backend.json`, `evidence-data.json`.
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
Answer every challenge in `challenges-round-<n>.json`, in `rebuttals-round-<n>.json`:
either `refuted` (quote the code that proves the challenge wrong) or `accepted`
(then revise the draft: explanation, causal chain, fix direction or regression
test idea). You may read code yourself to answer. A challenge without a quoted
refutation is accepted.
If any challenge was accepted, run the skeptic again on the revised draft
(round n+1). Stop when a round has no accepted challenge, or after 3 rounds.
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
