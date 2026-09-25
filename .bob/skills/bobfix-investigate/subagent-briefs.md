# Subagent briefs

Each brief is sent to one `explore` subagent. Replace `{BUG}` with the bug
report and `{PATHS}` with the relevant paths from `map.json`.

Every subagent must end its answer with ONE fenced ```json block matching
`evidence.schema.json`, and nothing after it.

## Frontend investigator

```
Bug report: {BUG}
Scope: frontend code only — {PATHS}
Investigate how the client stores credentials, when it calls the API,
how it reacts to 401/403 errors, how and how often it refreshes the session,
and when it logs the user out. Pay attention to what happens on page reload
and when several requests are in flight at the same time.
Quote exact code (file + line range) for every piece of evidence.
Do not propose code. Report hypotheses with a confidence between 0 and 1.
Return JSON per evidence.schema.json with "agent": "frontend-investigator"
and evidence ids F1, F2, ...
```

## Backend investigator

```
Bug report: {BUG}
Scope: backend code only — {PATHS}
Investigate the authentication middleware, token validation, the session
refresh endpoint and the services it calls. Trace the exact order of
operations inside the refresh flow, including every await, and what happens
when two refresh requests for the same session arrive at the same time.
Quote exact code (file + line range) for every piece of evidence.
Do not propose code. Report hypotheses with a confidence between 0 and 1.
Return JSON per evidence.schema.json with "agent": "backend-investigator"
and evidence ids B1, B2, ...
```

## Data investigator

```
Bug report: {BUG}
Scope: schema, migrations and data-access code — {PATHS}
Investigate how sessions / tokens are persisted, which queries read and
revoke them, whether revocation is per-token or cascades to other rows,
and whether any operation that should be atomic is split across statements.
Quote exact code (file + line range) for every piece of evidence.
Do not propose code. Report hypotheses with a confidence between 0 and 1.
Return JSON per evidence.schema.json with "agent": "data-investigator"
and evidence ids D1, D2, ...
```
