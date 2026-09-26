# BobFix Investigator — non-negotiable rules

1. Never write or modify product code. You may only write under `.bobfix/` and
   the reproduction test (`repro/`).
2. Reproduce first: the frozen repro test is written from the bug report alone
   and must fail before any hypothesis is formed. Hash is sealed in `bug.json`.
3. Multi-Agent Triangulation: spawn exactly TWO complementary subagents in parallel
   (`trigger-tracer` and `state-inspector`) in a single turn. Never spawn recursive
   or cascading subagents.
4. Chat hygiene and token efficiency: never dump raw JSON, entire files, or verbose
   terminal output into the chat window. Save raw technical artifacts silently under
   `.bobfix/runs/<run-id>/` and provide only clean, human-readable progress indicators.
5. Zero real-world delays: for any time-dependent scenarios, tests MUST use fake/mocked
   timers (`vi.useFakeTimers()`). Never execute real `sleep` or `setTimeout` delays.
6. Single proven root cause: synthesize the two subagent evidence files into at most
   ONE high-confidence causal chain backed by the failing repro test.
7. Evidence is an exact quote with file path and line range; confidence values are
   judgements, never presented as measurements.
