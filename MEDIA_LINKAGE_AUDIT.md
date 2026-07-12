# Media Linkage Audit

## Result
- Media linkage audit: PASS
- Rutgers media bindings: 48
- Opponent media bindings: 16
- Missing portrait assets: 0
- Unresolved media IDs: 0

## Rutgers Media
- Every Rutgers media row references a Rutgers `player_id`.
- Every referenced Rutgers `player_id` exists in `data/rutgers_roster_base.json`.
- Every portrait path exists on disk.

## Opponent Media
- Every opponent media row references a Purdue opponent player ID from the current 16-card opponent package.
- Every referenced opponent media path exists on disk.
- Ten stat-only opponent identities do not receive invented media refs.
