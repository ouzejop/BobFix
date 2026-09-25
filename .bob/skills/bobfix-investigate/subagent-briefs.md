# Investigator brief (one per scope)

In step 3 you choose THREE scopes from `map.json` — the three parts of the system
the bug report's flow passes through (for example: client/UI, request handling and
business logic, persistence, integrations with external services, webhooks,
queues and background jobs, scheduled tasks, configuration). Pick scopes that
together cover the whole path from the user-visible symptom to where state is
stored or decided. Give each a short kebab-case name (e.g. `client`, `checkout-api`,
`payments-webhook`) and a one-letter evidence prefix (first letter, upper case,
unique across the three).

Send the brief below to each explore subagent, replacing `{BUG}`, `{SCOPE}`,
`{PATHS}`, `{NAME}` and `{PREFIX}`. Do not add your own guesses about the cause.

```
Bug report: {BUG}
Scope: {SCOPE} only — {PATHS}

Trace the flow that produces the reported symptom through this scope:
- entry points: what triggers this code (user actions, requests, events,
  callbacks, jobs, timers) and how often or how many times it can be triggered;
- state: what it reads and writes, in what order, and what decides success or
  failure;
- ordering: every await / callback / network or database call, and what happens
  if the same flow runs twice, concurrently, out of order, or is retried;
- failure paths: what happens on errors, timeouts or unexpected responses, and
  whether those paths are visible to the user or silently swallowed;
- boundaries: what this scope assumes about the other parts of the system.

Quote exact code (file + line range) for every piece of evidence.
Do not propose code. Report hypotheses with a confidence between 0 and 1,
including ones your evidence contradicts.
Return JSON per evidence.schema.json with "agent": "{NAME}-investigator"
and evidence ids {PREFIX}1, {PREFIX}2, ...
```
