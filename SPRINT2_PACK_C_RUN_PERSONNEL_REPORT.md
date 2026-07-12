# SPRINT2_PACK_C_RUN_PERSONNEL_REPORT

Validated: 2026-07-12

## Completed

- Added `data/weekly/coaching_decisions.json`.
- Added static GitHub Pages bundle `data/weekly/coaching_decisions.js`.
- Added isolated run-style resolver for outside, inside, short-yardage, and goal-line concepts.
- Every run Play Card resolves Recommended Ball Carrier, optional secondary, and reason when weekly decisions exist.

## Current Weekly Results

- Outside run concepts resolve to `j-haskins-hb`.
- Inside/power concepts resolve to `t-simonson-hb`.
- Renderer does not hardcode player names; names resolve from roster by stable `player_id`.

## Result

PASS - Running-back assignment is JSON-driven.
