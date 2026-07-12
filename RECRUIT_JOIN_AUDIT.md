# RECRUIT_JOIN_AUDIT

Generated: 2026-07-12

## Scope

Audited recruiting identity joins from weekly board records to canonical prospect/scouting records. No football data was invented.

## Join Rules

Recruit joins now follow:

1. canonical `prospect_id`
2. explicit legacy-ID migration mapping
3. exact normalized full name plus exact position
4. exact normalized full name plus state plus position
5. validation failure for unresolved required joins

The renderer does not use array index, board order, surname-only, display-text-only, or position-only matching.

## Counts

- Recruit board records: 35
- Recruit scouting records: 62
- Canonical prospect IDs: 62
- Successful board-to-scouting joins: 1
- Source-missing board-to-scouting detail rows: 34
- Failed joins: 0
- Board-rank mismatches: 0

## Result

PASS. Canonical joins are explicit, failed joins are not masked as normal limited data, and board rank is never derived from list position.
