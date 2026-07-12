# RUTGERS_PLAYER_DETAIL_JOIN_AUDIT

Generated: 2026-07-12

## Scope

Audited Rutgers player detail joins for roster identity, attributes, media, production stats, and depth role.

## Counts

- Roster records: 48
- Canonical player IDs: 48
- Attribute joins: 48
- Media joins: 48
- Last Game roster joins: 6
- Season roster joins: 18
- Development-trait joins: 0
- Failed joins: 0

## Source Missing

- Last Game production source-missing: 42 roster players
- Season production source-missing: 30 roster players
- Development trait source-missing: 48 roster players

These are source coverage gaps in the authoritative JSON, not identity failures.

## Result

PASS. Player cards resolve identity, attributes, media, and available stats by `player_id`; genuinely absent production renders as `N/A` or remains hidden according to existing card behavior.
