# CHANGELOG

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
