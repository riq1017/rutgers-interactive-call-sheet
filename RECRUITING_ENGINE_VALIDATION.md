# RECRUITING_ENGINE_VALIDATION

- PASS - Recruiting Engine reads the same shared roster base as the Gameplan Engine.
- PASS - Recruiting package is separated into `data/recruiting_weekly.json`.
- PASS - Recruiting import rejects non-recruiting package types before assignment.
- PASS - Priority order starts with on-field performance, then shared depth chart, future depth, scheme fit, team targets, and feasibility.
- PASS - Team Needs are supporting evidence, not the only priority signal.
- PASS - Unknown prospect ratings, interest, visits, scouting, and physicals remain null.
- PASS - User-facing Recruiting page hides diagnostic metadata while preserving it in source JSON.

Known limitation: the seed package does not verify most prospect fields, so many Recruiting cards intentionally show Unknown.
