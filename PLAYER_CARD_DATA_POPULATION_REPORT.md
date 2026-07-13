# Player Card Data Population Report

UI binding changes:
- Rutgers player cards and detail screens merge `VIDEO_VERIFIED_RUTGERS_ROSTER_RECOVERY` by `player_id`.
- Purdue player cards and detail screens merge `VIDEO_VERIFIED_PURDUE_ROSTER_RECOVERY` by `player_id`.
- Purdue opponent browser also promotes verified season-stat identities so MIKE/WILL/FS/SS/CB players are not hidden just because they were outside the original 16-player roster-card package.
- Recruit cards and detail screens merge `VIDEO_VERIFIED_RUTGERS_BOARD_SCOUTING_RECOVERY` by `prospect_id` or explicit legacy ID.

Visible card/detail additions:
- Development trait badges where verified.
- Physical abilities.
- Mental abilities.
- Verified position-aware attributes.
- Evidence notes in player detail Traits panel.
- Source-missing opponent groups are shown explicitly instead of being silently omitted.

Protection rules:
- `needs_review` values are shown as needs-review evidence, not converted into verified football data.
- `N/A` remains only where source video did not reveal the field or the frame showed question marks.
- Internal IDs remain hidden in production UI text.
