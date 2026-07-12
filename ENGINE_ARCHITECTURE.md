# ENGINE_ARCHITECTURE

The app now uses a two-engine data model with one shared Rutgers roster foundation.

## Shared foundation
- `data/rutgers_roster_base.json` is the only shared roster base.
- Gameplan and Recruiting packages both reference `data/rutgers_roster_base.json` through `shared_roster_file`.
- The base preserves nulls where the supplied seed or corrected roster package did not verify a value.

## Gameplan Engine
- Existing playbook, eligibility, player-fit scoring, recent-call penalties, setup bonuses, and Top 3 diversity remain in `app.js`.
- Weekly gameplan metadata lives in `data/gameplan_weekly.json` and `window.GAMEPLAN_WEEKLY` from `data/engine_data.js`.
- Gameplan imports accept only `package_type: "gameplan_weekly_update"` and do not overwrite Recruiting data.

## Recruiting Engine
- Recruiting priority uses performance need, shared roster depth signals, future depth risk, scheme fit, team targets, and feasibility.
- Weekly recruiting metadata lives in `data/recruiting_weekly.json` and `window.RECRUITING_WEEKLY` from `data/engine_data.js`.
- Recruiting imports accept only `package_type: "recruiting_weekly_update"` and do not overwrite Gameplan data.

## Schemas
- `ROSTER_BASE_SCHEMA.json`
- `GAMEPLAN_WEEKLY_SCHEMA_v2.json`
- `RECRUITING_WEEKLY_SCHEMA_v2.json`

## UI Ownership
- Gameplan: situation controls, Best Call, Top 3 alternatives, tactical summary, usage, alerts, opening script, scouting, history.
- Top Plays: ranked list plus concept and formation filters.
- Personnel & Matchups: shared roster, weekly usage, protection, run direction, opponent defense, matchup matrix.
- Recruiting: summary, Team Needs, priority engine, filters, board, detail, weekly actions.
- More: Gameplan JSON import/export, Recruiting JSON import/export, package names, week, opponent, last updated, validation/import status.
