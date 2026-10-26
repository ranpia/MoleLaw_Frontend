# MoleLaw frontend simulation context

Updated: 2026-10-26. Uses the local backend fixture derived from the running server OpenAPI; no published owner mock was pulled (CLI signed out).

## Purpose

Run the frontend against the backend member in `frontend.sim.yaml`. Account/title behavior is covered by `scripts/browser-check.mjs account`; handler details live in `../mocks/backend/default.js`.

## Execution

1. `postman simulation run postman/simulations/frontend.sim.yaml --port 4900 --no-history --output ndjson`
2. In PowerShell set `$env:API_PROXY_TARGET = 'http://127.0.0.1:4900/backend'`, then `npm.cmd run dev -- --port 5174 --configLoader runner`.
3. `node scripts/browser-check.mjs account`
4. Confirm backend request events for title PATCH, profile/list reload, CSRF and password PATCH. Stop both dedicated processes with Ctrl+C.

## Assumptions

- Observed 2026-10-26: each run must start with fresh fixture state because the account check changes its password. Restart the simulation before repeating.
- Observed 2026-10-26: the account check proves browser/client behavior, not server password hashing, ownership enforcement or persistence. Real password behavior is covered separately by `scripts/verify-local-api.mjs`; successful real title rename requires its optional consultation flow, which incurs AI cost.
- The suggestions check includes minimal first/follow-up NDJSON completion fixtures. These do not model retrieval, citation verification or arbitrary stream failures; the older full chat simulation check has not been rerun.

## Observations

<!-- begin:observations -->
- 2026-10-26: bubble UI rerun passed; backend received one first-NDJSON request for a double click on the selected bubble, plus recommendation, follow-up and fallback requests. No member was silent.
- 2026-10-26: suggestions browser check passed; backend served explicit recommendation calls, first/follow-up NDJSON and the controlled recommendation 500. Late recommendation cancellation and raw-question fallback passed. No member was silent.
- 2026-10-26: account browser check passed. The sole member `backend` served profile, list, CSRF, title update/reload and failed/successful password changes; no member was silent. No actual AI calls or real user accounts were used.
<!-- end:observations -->

## What didn't work

- 2026-10-26: host Vite exited with `EBUSY` while watching the test Chrome profile's Cookies file under `.artifacts.local`. Excluding that directory from Vite's watcher fixed the rerun.
