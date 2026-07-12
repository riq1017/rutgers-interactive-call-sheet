# PHASE1_2_DATA_INTEGRITY_POSITION_COVERAGE_AUDIT

Audited: 2026-07-12

Baseline commit: `bdd1ddc78227cfa0c144ad1eecf9364d6eff26d3`

## Executive Result

- PASS - Rutgers roster count is 48.
- PASS - Current opponent player count is 16.
- PASS - Player-card registry count is 64.
- PASS - Rutgers media rows cover all 48 Rutgers players.
- PASS - Opponent media rows cover all 16 current opponent players.
- PASS - All 64 portrait assets exist on disk.
- PASS - Player matchup rows reference existing Rutgers and opponent player IDs.
- PASS - Oregon visible playbook remains 192 verified formation/play combinations.
- LIMITED - Production-stat coverage is partial by position.
- LIMITED - Direct player-vs-player matchup coverage is intentionally partial and does not cover every roster position.

## Data Integrity Checks

| Check | Result |
| --- | --- |
| Rutgers media missing player IDs | PASS - none |
| Opponent media missing player IDs | PASS - none |
| Rutgers registry missing player IDs | PASS - none |
| Opponent registry missing player IDs | PASS - none |
| Missing portrait files | PASS - none |
| Matchup rows with missing Rutgers IDs | PASS - none |
| Matchup rows with missing opponent IDs | PASS - none |

## Inventory Counts

| Item | Count |
| --- | ---: |
| Rutgers roster players | 48 |
| Current opponent players | 16 |
| Rutgers media entries | 48 |
| Opponent media entries | 16 |
| Player-card registry entries | 64 |
| Portrait files present | 64 |
| Player matchup rows | 7 |
| Oregon visible play combinations | 192 |
| Recruiting prospects | 61 |

## Rutgers Position Coverage

| Position | Players | Media | Last Game Stats | Season Stats | Direct Matchups |
| --- | ---: | ---: | ---: | ---: | ---: |
| QB | 2 | 2 | 2 | 2 | 0 |
| HB | 3 | 3 | 2 | 3 | 2 |
| WR | 7 | 7 | 2 | 5 | 0 |
| TE | 2 | 2 | 0 | 2 | 1 |
| LT | 2 | 2 | 0 | 0 | 1 |
| LG | 1 | 1 | 0 | 0 | 0 |
| C | 2 | 2 | 0 | 0 | 1 |
| RG | 1 | 1 | 0 | 0 | 1 |
| RT | 1 | 1 | 0 | 0 | 1 |
| EDGE | 6 | 6 | 0 | 1 | 0 |
| DT | 4 | 4 | 0 | 1 | 0 |
| LB | 7 | 7 | 0 | 2 | 0 |
| CB | 5 | 5 | 0 | 1 | 0 |
| FS | 1 | 1 | 0 | 0 | 0 |
| SS | 2 | 2 | 0 | 1 | 0 |
| K | 1 | 1 | 0 | 0 | 0 |
| P | 1 | 1 | 0 | 0 | 0 |

## Opponent Position Coverage

| Position | Players | Media | Last Game Stats | Season Stats | Direct Matchups |
| --- | ---: | ---: | ---: | ---: | ---: |
| EDGE | 7 | 7 | 2 | 2 | 2 |
| DT | 5 | 5 | 1 | 1 | 2 |
| LB | 4 | 4 | 0 | 0 | 2 |

## Position Coverage Findings

- Rutgers offensive skill production is the strongest coverage area: QB, HB, WR, and TE have usable season or last-game data.
- Rutgers offensive line has media and roster coverage, plus direct matchup rows for LT, C, RG, and RT, but no verified production-stat rows.
- Rutgers defense has full roster/media coverage but limited production coverage and no direct player-vs-player matchup rows in the current weekly package.
- Specialists have roster/media coverage but no verified production-stat rows in the Phase 1.2 package.
- Current opponent coverage is defensive-front focused. EDGE, DT, and LB are represented; defensive backs and offensive opponent players are not present in the current opponent-player package.
- Opponent linebacker media exists, and LB matchup rows exist, but no opponent LB last-game or season stat rows are present.

## Current Limitations

- No football data should be inferred to fill gaps. Missing stat coverage should continue to render as `Limited data`.
- Direct matchup coverage should not be expanded unless a future verified source supplies the missing player-vs-player evidence.
- Opponent media is weekly replaceable and currently only covers the current Purdue package.
- The 192 Oregon visible play combinations remain verified-visible inventory, not a claim of complete playbook coverage.

## Recommended Next Data Work

- Add verified production rows for Rutgers offensive linemen, defenders, kickers, and punters if visible source material is provided.
- Add verified opponent defensive-back or offensive-player packages only when supplied by a weekly source package.
- Add direct player-vs-player matchup rows for WR/DB, QB/pressure, and defensive Rutgers positions only when verified evidence exists.
- Keep the UI behavior from Phase 1.2: show `Limited data` rather than inventing values.
