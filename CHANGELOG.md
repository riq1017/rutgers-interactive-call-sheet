# CHANGELOG

## Adaptive Recommendation Engine

- Added recent-call memory in `localStorage` with an 8-call window separate from result history.
- Added exact-play repetition penalties for the last play, last 3 calls, and last 6 calls.
- Added concept-family rotation across inside run, outside run, option, RPO, quick pass, intermediate pass, deep pass, screen, and play action.
- Added setup bonuses from successful inside runs, screens, quick passes, failed deep passes, and sacks.
- Added drive-context modifiers for 1st down, 2nd and short, 3rd and medium, red zone, protect lead, and must score.
- Added Top 3 diversity logic so recommendations include multiple concept families when possible.
- Added visible scoring breakdowns for base score, matchup modifier, situation modifier, recent-call penalty, setup bonus, risk penalty, and final score.
- Preserved weekly package import/export, existing local result logging, Rutgers design, and separated data files.
- Expanded `tools/validate.js` with behavioral tests for repetition, family rotation, setup bonuses, diverse Top 3, and context-sensitive rankings.
- Regenerated `VALIDATION_REPORT.md`.

## Hardened Rutgers Interactive Call Sheet

- Preserved the Rutgers scarlet/black/white phone-first UI and extended the existing call-card flow instead of rebuilding the interface.
- Added static no-JavaScript Purdue fallback content in `index.html`.
- Added weekly JSON export and import controls backed by a separate `localStorage` key.
- Added validation for imported weekly packages, including 12 unique valid opening-script play IDs.
- Expanded result logging with yards, sack, turnover, explosive, third-down conversion, and red-zone touchdown fields.
- Kept recent-history ranking modifiers capped from -6 to +6.
- Normalized UI-only situations such as backed up, fringe, and protect lead into existing playbook buckets without adding new unverified football data.
- Added repeatable validation script at `tools/validate.js`.
- Updated `README.md` with iPhone and Windows instructions, weekly workflow, output behavior, validation, and limitations.
- Regenerated `VALIDATION_REPORT.md` from the validator.
