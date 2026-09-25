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
    { "id": "HB1", "statement": "...", "status": "supported",    "evidence": ["B2", "D1"] },
    { "id": "HF2", "statement": "...", "status": "rejected",     "evidence": ["F3"], "reason": "..." },
    { "id": "HD2", "statement": "...", "status": "inconclusive", "evidence": [],     "reason": "..." }
  ],
  "fix_direction": {
    "summary": "What must change and where. No code.",
    "files": ["path/one.ts"],
    "regression_test_idea": "The scenario a test must reproduce (inputs -> expected vs actual)."
  },
  "skeptic": {
    "rounds": 2,
    "challenges": 5,
    "accepted": 2,
    "refuted": 3,
    "changes": ["What the conclusion or fix direction changed because of accepted challenges"]
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
