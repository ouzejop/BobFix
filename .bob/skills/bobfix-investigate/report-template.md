# root-cause.json template

```json
{
  "run_id": "20260926-1030-random-logout",
  "root_cause": {
    "title": "One line naming the mechanism, not the symptom",
    "explanation": "3-5 sentences, plain language, no speculation.",
    "confidence": 0.95,
    "causal_chain": [
      { "step": 1, "scope": "trigger", "evidence": ["T1"], "what": "..." },
      { "step": 2, "scope": "state",   "evidence": ["S1"], "what": "..." }
    ],
    "affected_files": ["path/one.ts", "path/two.ts"]
  },
  "hypotheses": [
    { "id": "HT1", "statement": "...", "status": "confirmed", "evidence": ["T1", "S1"], "experiments": ["repro_test"] }
  ],
  "fix_direction": {
    "summary": "What must change and where. No code.",
    "files": ["path/one.ts"],
    "regression_test_idea": "The scenario a test must reproduce (inputs -> expected vs actual)."
  },
  "stats": {
    "files_examined": 0,
    "evidence_count": 0,
    "subagents": 2,
    "experiments": 0,
    "started_at": "ISO 8601",
    "finished_at": "ISO 8601"
  }
}
```

Rules:
- `confidence` is the investigator's judgement, not a computed value.
- Every item in `causal_chain` cites at least one evidence ID from either `T` (trigger) or `S` (state).
- The root cause is confirmed by the frozen reproduction test (`repro_test`) or a targeted experiment in `experiments.json`.

