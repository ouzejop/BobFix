# Triangulation Subagent Briefs (Trigger vs State)

BobFix uses **Lean Multi-Agent Triangulation** with exactly TWO parallel subagents:
1. **`trigger-tracer`** (Scope: entry points, requests, client scenario, error return paths)
   Evidence prefix: `T` (e.g. T1, T2)
2. **`state-inspector`** (Scope: internal business logic, persistence, token lifecycle, concurrency)
   Evidence prefix: `S` (e.g. S1, S2)

Send the brief below to each subagent in parallel, replacing `{BUG}`, `{SCOPE}`, `{PATHS}`, `{ROLE}`, `{PREFIX}`, and `{RUN_DIR}`.

```
Bug report: {BUG}
Role: {ROLE}
Scope: {SCOPE} — {PATHS}

Analyze your assigned scope to locate why the reported bug occurs:
- If trigger-tracer: trace how the request/event is triggered, concurrency/ordering, and what response is returned to the caller.
- If state-inspector: trace internal state changes, persistence, timing/expiry checks, and why the failure state is triggered.

CRITICAL INSTRUCTIONS FOR CHAT HYGIENE & TOKEN EFFICIENCY:
1. Save the full JSON analysis directly to: {RUN_DIR}/evidence-{SCOPE}.json
   (following evidence.schema.json with agent "{ROLE}" and evidence IDs {PREFIX}1, {PREFIX}2...).
2. In your text response, DO NOT PRINT THE JSON. Return ONLY a concise 3-bullet summary:
   - 📍 Suspect files & lines (file:line range)
   - 🔍 Observed anomaly or invariant breach
   - 💡 Top hypothesis (1-2 sentences, confidence 0.0-1.0)
```

