---
name: bobfix-investigate
description: Fast, token-efficient multi-agent bug investigation — reproduce with a single frozen test, triangulate via two parallel subagents (trigger vs state), and synthesize an experiment-backed root cause without redundant loops or chat bloat.
---
You are running a Lean BobFix investigation. Reading code produces hypotheses;
running code produces conclusions. You never waste tokens or flood the chat.

<Steps>
<Step>
INITIALIZE & PRE-FILTER.
Create `.bobfix/runs/<run-id>/` (`YYYYMMDD-HHMM-<short-slug>`).
Write `bug.json` with the bug report, `git rev-parse HEAD` and start time (ISO 8601).
Perform deterministic search (grep / ripgrep in at most 2 calls) to locate relevant entrypoints,
error messages, and test runner configuration. Write `map.json`.
Print in chat: `🔍 [1/4] Bug report catalogué et points d'entrée repérés.`
</Step>

<Step>
REPRODUCE (Frozen Test).
Using ONLY the bug report and entry points, write ONE reproduction test under `tests/repro/`
that drives the system through its public interface and asserts what the user expects.
Symptom first: find in the client code what directly PRODUCES the reported symptom (e.g. which
response makes the client log out). Replay every call of the user scenario the way the client
makes it (sequential, parallel, retried) and assert that NONE of them produces that trigger.
A test that tolerates the trigger on one of the calls does not reproduce the bug.
For any time-dependent scenarios, ALWAYS use fake/mocked timers (`vi.useFakeTimers()`) — NEVER wait for real delays.
Run the test: it MUST fail.
Compute SHA-256 of the test file and record in `bug.json`: `repro_test: { path, sha256 }` (hex digest, never null) and the failing assertion.
This test is permanently frozen: nobody edits it afterwards.
Print in chat: `❌ [2/4] Bug fidèlement reproduit (Test gelé sous tests/repro/).`
</Step>

<Step>
PARALLEL MULTI-AGENT TRIANGULATION.
Spawn exactly TWO specialized subagents in parallel in a SINGLE tool call (see `subagent-briefs.md`):
1. `trigger-tracer` (Scope: client / API entrypoint / error status received by caller)
2. `state-inspector` (Scope: server core / state transitions / persistence / timing checks)
Instructions to subagents:
- Subagents may be read-only: they return ONLY their evidence as compact JSON (evidence.schema.json).
- You write each answer to `.bobfix/runs/<run-id>/evidence-<scope>.json` without echoing it in chat.
Print in chat: `🤝 [3/4] Triangulation multi-agents (Trigger vs State) complétée.`
</Step>

<Step>
SYNTHESIS & ROOT CAUSE.
Read the two evidence files from disk.
Synthesize the findings into at most ONE high-confidence causal chain.
Every step that relies on an ordering or interleaving of concurrent requests cites the file:line
of the `await` (or other suspension point) that allows it. If the code between a read and the
write that depends on it is synchronous, that interleaving cannot happen: drop it and re-read the code.
The fix direction must make the frozen repro test pass on EVERY call of the scenario, not only one.
In `fix_direction`, define the functional requirements and relevant domain architectural
patterns (e.g. concurrency grace window, atomic claims, idempotent transactions).
Never prematurely forbid standard industry patterns.
The frozen repro test proves the end-to-end failure. If an internal invariant needs
targeted verification before fixing, run at most ONE micro-test under `tests/experiments/`
(using fake timers), record in `experiments.json`, and move it into `.bobfix/runs/<run-id>/experiments/`.
Write `root-cause.json` following `report-template.md`.
</Step>

<Step>
USER SUMMARY (Clean & Readable).
Output a clean, concise markdown summary table in the chat (NO raw JSON, NO code dumps):
- **Repro Test**: path and failing assertion
- **Root Cause**: concise 2-sentence mechanism (files & lines)
- **Fix Direction**: what must change
End with:
"Switch to **BobFix Fixer** to apply and verify the fix."
</Step>
</Steps>

