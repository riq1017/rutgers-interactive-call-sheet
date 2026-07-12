# PLAYER_CARD_RENDERING_REPORT

Validated: 2026-07-12

- PASS - Rutgers player cards render from `rutgers_roster_base.json` and media bindings, not duplicated ratings.
- PASS - Opponent player cards render from weekly opponent player data and weekly media bindings.
- PASS - Last Game and Season production are separate compact sections.
- PASS - Nested stat objects are formatted as labels/chips instead of raw object strings.
- PASS - Missing production values render as `Limited data`.
- PASS - Portraits retain stable `player_id` binding and improved frame/crop presentation.

Counts:

- Rutgers cards: 48
- Opponent cards: 16
- Registry entries: 64
- Portrait assets: 64
