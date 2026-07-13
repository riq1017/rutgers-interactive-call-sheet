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
- Recruit compact cards and detail screens now display the user-confirmed four-star class marker as `4★` for every current Rutgers board/class recruit.
- Purdue player detail screens read evidence from all current verified record shapes and render recommendations as full-width callouts to prevent mobile text collision.
- Recruit detail hero cards use a compact two-column sports profile layout with the status badge on its own row, preventing one-character-per-line wrapping on iPhone widths.

Protection rules:
- `needs_review` values are shown as needs-review evidence, not converted into verified football data.
- `N/A` remains only where source video did not reveal the field or the frame showed question marks.
- Internal IDs remain hidden in production UI text.
- The four-star class display does not populate unrelated missing fields such as national rank, height, weight, attributes, abilities, mentals, or development trait.
