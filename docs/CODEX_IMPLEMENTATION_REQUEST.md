# CODEX IMPLEMENTATION REQUEST

## Objective
Harden and validate the attached Rutgers Interactive Phone Call Sheet baseline. Purdue is the first weekly opponent, not the app identity.

## Required work
1. Preserve Rutgers scarlet/black/white phone-first design.
2. Preserve separation between permanent app code, Rutgers weekly data, opponent weekly data, and local game history.
3. Validate all play IDs, opening-script references and situation coverage.
4. Add a static no-JavaScript Purdue call-sheet fallback generated from the same data.
5. Add export/import for weekly JSON packages without breaking iPhone local use.
6. Add richer result logging: yards, sack, turnover, explosive, third-down conversion and red-zone touchdown.
7. Keep history modifiers capped.
8. Do not fabricate ratings not visible in source notes.
9. Return a validated ZIP and validation report.

## Acceptance criteria
- Opens cleanly at iPhone width.
- Best Call and Top 3 work.
- Search and tabs work.
- Result history survives refresh.
- Purdue matchup traits appear.
- Inside runs/RPOs/screens are promoted.
- Slow deep dropbacks are penalized.
- Opening script has 12 valid unique references.
- Rutgers weekly stats and opponent weekly data can be replaced independently.
- No UI rebuild.
