# GAMEPLAN_ENGINE_VALIDATION

- PASS - Existing statistical recommendation engine preserved.
- PASS - Down-and-distance eligibility remains enforced.
- PASS - Player-fit scoring remains active and uses verified weekly player records.
- PASS - Recent-call penalties and setup bonuses remain active.
- PASS - Top 3 diversity remains active.
- PASS - `data/gameplan_weekly.json` references `data/rutgers_roster_base.json`.
- PASS - Gameplan import rejects non-gameplan package types before assignment.
- PASS - No run is recommended in the validated 4th-and-long scenario.
- PASS - Missing gameplan weekly values display as Not available.

Known limitation: the weekly plan can only score line/run/protection details when those fields are present in the imported weekly JSON. Missing values remain neutral.
