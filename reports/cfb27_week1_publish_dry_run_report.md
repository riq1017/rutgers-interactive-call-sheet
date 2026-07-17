# Week 1 Dynasty Publish

Production Rutgers app data modified: yes.

Staging source: `C:\Users\tharg\Documents\GitHub\rutgers-interactive-call-sheet\data\generated\dynasty\staging`
Preview output: `C:\Users\tharg\Documents\GitHub\rutgers-interactive-call-sheet\data\generated\dynasty\publish_preview`
Backup destination: `C:\Users\tharg\Documents\GitHub\rutgers-interactive-call-sheet\data\generated\dynasty\rollback\20260717T004345Z`

## Production Files Targeted
- rutgers_roster: `data\rutgers_roster_base.json`
- engine_bundle: `data\engine_data.js`
- rutgers_team_bundle: `data\rutgers_team.js`
- weekly_plan_bundle: `data\weekly_plan.js`
- gameplan_weekly: `data\gameplan_weekly.json`
- rutgers_season_stats: `data\rutgers_season_stats.json`
- opponent_season_stats: `data\opponent_season_stats.json`
- rutgers_verified_stats_json: `data\video_verified\rutgers_season_stats.json`
- opponent_verified_stats_json: `data\video_verified\purdue_season_stats.json`
- rutgers_verified_stats_bundle: `data\video_verified\rutgers_season_stats.js`
- opponent_verified_stats_bundle: `data\video_verified\purdue_season_stats.js`
- opponent_verified_roster_json: `data\video_verified\purdue_roster.json`
- opponent_verified_roster_bundle: `data\video_verified\purdue_roster.js`
- opponent_recovery_bundle: `data\video_verified\purdue_roster_recovery.js`
- rutgers_recovery_bundle: `data\video_verified\rutgers_roster_recovery.js`
- manual_depth_chart: `data\depth_chart_seed.json`
- manual_depth_chart_bundle: `data\depth_chart_seed.js`

## Preserved Manual Files

## Validation
- Staging validation: PASS
- Preview compatibility: PASS
- Stale-opponent validation: PASS
- Stale Rutgers roster validation: PASS

## Warnings
- Existing app loads static JS bundles, so a real publish must update JS wrappers and matching JSON together.
- Legacy opponent bundle filenames contain Purdue, but Week 1 staging opponent is UMass.
- Player season stat files are valid empty Week 1 packages because no game has been played.
- Manual depth chart was validated against the current parser roster: 3 retained, 2 rejected.

## Opponent Scouting Provenance
- Save-derived fields: opponent identity, opponent roster, opponent injuries, team statistics, ratings
- Calculated fields: position-group scouting, run direction, pass protection, concept guidance
- Manual/static fields: Rutgers depth-chart context
- Unavailable fields: verified UMass left/right defensive alignment, individual player season stats before Week 1 is played

## Current Recommendations
- Run direction: right
- Run-direction alignment status: position_group_based_not_alignment_verified
- Run-direction reason: Rutgers right blocking group has the best available run-block/strength/overall blend. Avoid repeatedly challenging A. Melvin inside without constraint help.
- Pass protection: edge-aware / identify pre-snap
- Pass-protection alignment status: position_group_based_not_alignment_verified
- Pass-protection reason: Top UMass edge threat is A. Depaepe (LE, 76 OVR). Exact left/right alignment is not parser-verified, so slide/chip calls should key the identified edge threat pre-snap.

## Full Validation Suite
- `C:\Users\tharg\AppData\Local\Programs\Python\Python312\python.exe -m compileall -q C:\Users\tharg\Documents\GitHub\rutgers-interactive-call-sheet\tools\cfb27_save_reader`: PASS
- `C:\Users\tharg\AppData\Local\Programs\Python\Python312\python.exe -m unittest discover -s C:\Users\tharg\Documents\GitHub\rutgers-interactive-call-sheet\tools\cfb27_save_reader\tests -v`: PASS
- `C:\Users\tharg\AppData\Local\Programs\Python\Python312\python.exe -m unittest tests.test_process_week`: PASS
- `node --check app.js`: PASS
- `node --check tools/validate.js`: PASS
- `node tools/validate.js`: PASS

## Fields Remaining Unavailable
- Individual player season statistics: unavailable before Week 1 is played.
- Parser-derived Rutgers depth chart: unavailable; manual/static depth chart preserved.
- Manual depth chart: stale entries are rejected and published only as unavailable/manual-verification slots.
- Recruiting and awards: outside this Week 1 MVP publish.

## Publish Outcome
- Mode: real publish
- Production changed: yes
- Rollback status: not_needed_validation_passed
- Files replaced:
  - `data\rutgers_roster_base.json`
  - `data\engine_data.js`
  - `data\rutgers_team.js`
  - `data\weekly_plan.js`
  - `data\gameplan_weekly.json`
  - `data\rutgers_season_stats.json`
  - `data\opponent_season_stats.json`
  - `data\video_verified\rutgers_season_stats.json`
  - `data\video_verified\purdue_season_stats.json`
  - `data\video_verified\rutgers_season_stats.js`
  - `data\video_verified\purdue_season_stats.js`
  - `data\video_verified\purdue_roster.json`
  - `data\video_verified\purdue_roster.js`
  - `data\video_verified\purdue_roster_recovery.js`
  - `data\video_verified\rutgers_roster_recovery.js`
  - `data\depth_chart_seed.json`
  - `data\depth_chart_seed.js`

## Publish Decision
Week 1 data safe to publish after explicit approval: YES
