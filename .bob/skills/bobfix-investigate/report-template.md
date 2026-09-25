# root-cause.json template

```json
{
  "run_id": "20260926-1030-random-logout",
  "root_cause": {
    "title": "One line, e.g. 'Refresh-token rotation race triggers reuse detection'",
    "explanation": "3-5 sentences, plain language, no speculation.",
    "confidence": 0.0,
    "causal_chain": [
      { "step": 1, "layer": "frontend", "evidence": ["F1"], "what": "..." },
      { "step": 2, "layer": "backend",  "evidence": ["B2"], "what": "..." },
      { "step": 3, "layer": "data",     "evidence": ["D1"], "what": "..." }
    ],
    "affected_files": ["path/one.ts", "path/two.ts"]
  },
  "hypotheses": [
    { "id": "HB1", "statement": "...", "status": "supported",    "evidence": ["B2", "D1"] },
    { "id": "HF2", "statement": "...", "status": "rejected",     "evidence": ["F3"], "reason": "..." },
    { "id": "HD2", "statement": "...", "status": "inconclusive", "evidence": [],     "reason": "..." }
  ],
  "fix_direction": {
    "summary": "What must change and where. No code.",
    "files": ["path/one.ts"],
    "regression_test_idea": "The scenario a test must reproduce (inputs -> expected vs actual)."
  },
  "stats": {
    "files_examined": 0,
    "evidence_count": 0,
    "subagents": 3,
    "started_at": "ISO 8601",
    "finished_at": "ISO 8601"
  }
}
```

Rules:
- `confidence` is the investigator's judgement, not a computed value. Say so in the viewer.
- Every item in `causal_chain` cites at least one evidence id that exists.
- At least one hypothesis is examined and rejected, with its reason.
