# Week 1 Rutgers Staging Mapping Report

This report is staging-only. Production Rutgers JSON and the approved UI were not changed.

- Status: PASS
- Rutgers players mapped: 85
- UMass players mapped: 85
- Rutgers injuries mapped: 12
- UMass injuries mapped: 10
- Schedule entries mapped: 12
- Rutgers team-stat records mapped: 1
- UMass team-stat records mapped: 1
- Player-stat state: Individual player season stat rows are absent or empty in the Week 1 unplayed export; this is not a parser failure.
- Depth-chart source: manual_static_existing_app_seed
- Manual depth-chart entries validated: 3
- Manual depth-chart entries rejected: 2

## Populated Fields

- Current week
- Rutgers stable team ID
- Rutgers roster player IDs
- Rutgers names, positions, jerseys, classes, overalls, and exported ratings
- Rutgers injury records
- Upcoming opponent UMass and team ID
- UMass roster player IDs, names, positions, jerseys, classes, overalls, and exported ratings
- Rutgers schedule entries and unplayed Week 1 game status
- Rutgers and UMass team-level statistics records
- UMass opponent scouting package generated from save-derived roster, injuries, and team-stat staging data
- Run-direction and pass-protection recommendations calculated from available ratings with alignment limitations labeled

## Still Unavailable

- Parser-derived Rutgers depth chart
- Individual player season-stat rows before any game has been played
- Verified UMass left/right defensive alignment
- Recruiting, awards, and national hub data in this MVP staging phase

## Manual Depth-Chart Rejections

- C: D. Sturgis (C) - not_present_in_current_85_player_roster
- RG: J. Felton (RG) - not_present_in_current_85_player_roster

## Validation

- PASS: staging validation completed without errors.
