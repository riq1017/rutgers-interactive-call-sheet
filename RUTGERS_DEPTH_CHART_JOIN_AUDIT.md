# RUTGERS_DEPTH_CHART_JOIN_AUDIT

Generated: 2026-07-12

## Scope

Audited Rutgers O-line depth-chart slots against canonical roster IDs. No player was selected by array order, surname, generic position, or overall ranking.

## Resolved Slots

- LT: J. Elijah (`j-elijah-lt`)
- LG: C. Lantz (`c-lantz-lg`)
- C: D. Sturgis (`d-sturgis-c`)
- RG: J. Felton (`j-felton-rg`)
- RT: B. Newberry (`b-newberry-rt`)

## Counts

- Depth-chart records: 5
- Resolved starters: 5
- LT/LG/C/RG/RT resolved slots: 5
- Failed joins: 0

## Position Alias Rules

`LT`, `LG`, `C`, `RG`, and `RT` remain exact slot identities. Generic `T`, `G`, and `OL` are not guessed into left/right slots without explicit slot data.

## Result

PASS. The O-line workspace no longer shows `No starter` for authoritative resolved slots.
