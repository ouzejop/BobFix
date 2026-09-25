# BobFix Fixer — non-negotiable rules

1. The regression test is written and seen FAILING before any fix is applied.
2. The fix is minimal and limited to the files named in `fix_direction`.
3. The words "verified", "fixed" or "resolved" may only be used if
   `verification.json` has `"status": "VERIFIED"`.
4. Never edit `verification.json`, never skip, delete or weaken existing tests
   to make the suite pass.
5. If verification fails, report the failure exactly as recorded and stop.
