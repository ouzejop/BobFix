# root-cause.json template

```json
{
  "run_id": "20260926-1030-random-logout",
  "root_cause": {
    "title": "One line naming the mechanism, not the symptom",
    "explanation": "3-5 sentences, plain language, no speculation.",
    "confidence": 0.0,
    "causal_chain": [
      { "step": 1, "scope": "client", "evidence": ["F1"], "what": "..." },
      { "step": 2, "scope": "api",      "evidence": ["B2"], "what": "..." },
      { "step": 3, "scope": "store",    "evidence": ["D1"], "what": "..." }
    ],
    "affected_files": ["path/one.ts", "path/two.ts"]
  },
  "hypotheses": [
    { "id": "HB1", "statement": "...", "status": "confirmed", "evidence": ["B2", "D1"], "experiments": ["E1"] },
    { "id": "HF2", "statement": "...", "status": "refuted",   "evidence": ["F3"], "experiments": ["E2"], "reason": "..." },
    { "id": "HD2", "statement": "...", "status": "inconclusive", "evidence": [], "experiments": [], "reason": "..." }
  ],
  "fix_direction": {
    "summary": "What must change and where. No code.",
    "files": ["path/one.ts"],
    "regression_test_idea": "The scenario a test must reproduce (inputs -> expected vs actual)."
  },
  "stats": {
    "files_examined": 0,
    "evidence_count": 0,
    "subagents": 0,
    "experiments": 0,
    "started_at": "ISO 8601",
    "finished_at": "ISO 8601"
  }
}
```

Rules:
- `confidence` is the investigator's judgement, not a computed value. Say so in the viewer.
- Every item in `causal_chain` cites at least one evidence id that exists.
- The root cause is confirmed by at least one experiment in experiments.json.
- Refuted hypotheses cite the experiment that refuted them.
