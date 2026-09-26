# BobFix: Lean Multi-Agent Bug Investigation for IBM Bob IDE

> **Proven fixes, not guesses — at a fraction of the token cost.**

BobFix brings state-of-the-art software engineering multi-agent research (inspired by *Agentless* and *NeurIPS 2024 MAGIS*) into **IBM Bob IDE**:

```
Bug Report 
   ↓
[Frozen Repro Test] (hash-sealed, fails on buggy code)
   ↓
[Parallel Triangulation] (2 focused subagents: Trigger Tracer vs State Inspector)
   ↓
[Evidence Synthesis] (zero chat bloat, silent disk logging)
   ↓
[Minimal Fix & Independent Verification] (scripts/verify.mjs → VERIFIED)
```

Built for the **IBM Bob 2.0 Hackathon** (lablab.ai, September 2026).

---

### Quick Start in IBM Bob IDE

1. **Open repository**: Open this folder in IBM Bob IDE (`File > Open Folder...`).
2. **Investigate**: Switch mode to **"BobFix Investigator"** and send your bug report:
   ```
   Users are logged out on page refresh after access token expires.
   ```
   BobFix reproduces the bug with a frozen test, runs parallel triangulation subagents, and synthesizes the root cause without blowing through credits or flooding the chat.
3. **Fix & Verify**: Switch mode to **"BobFix Fixer"** and send:
   ```
   Apply and verify the fix.
   ```
   BobFix writes a regression test, applies the minimal patch, and runs `scripts/verify.mjs` to mathematically prove the fix.

---

### Key Architectural Improvements

* **Lean Multi-Agent Triangulation**: Replaces open-ended, recursive subagent loops with exactly 2 complementary, parallel subagents (`trigger-tracer` and `state-inspector`).
* **Chat Hygiene & Anti-Bloat**: Technical evidence JSON files and terminal logs are written directly to `.bobfix/runs/`, leaving the chat interface clean and readable.
* **Bounded Verification**: The frozen repro test is the empirical proof. Eliminates redundant micro-experiments and real-time delays.
* **Credit Friendly**: Completes investigations in 3-4 agent turns instead of 25+ runaway turns.
