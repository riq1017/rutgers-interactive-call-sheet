# SPRINT2_PACK_B_TEAM_CARD_REPORT

Validated: 2026-07-12

## Completed

- Added reusable team-card rendering for Rutgers and the current weekly opponent.
- Rutgers team values resolve from `data/rutgers_roster_base.json` and existing team profile data.
- Opponent team values resolve dynamically from the current weekly opponent profile.
- Last Game and Season sections remain separate.
- Team cards are registry entries and render inside the expanded Game Header card.

## Data Rules

- No team ratings, records, or names were duplicated into the registry.
- Missing values render through the shared `Limited data` formatter.
- The current opponent remains replaceable through the weekly package.

## Result

PASS - Team cards render verified team identity, record, and OVR/OFF/DEF values without merging stat scopes.
