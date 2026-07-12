# CHANGELOG

## Two-engine roster foundation update
- Added shared Rutgers roster base at `data/rutgers_roster_base.json`.
- Added separate weekly packages: `data/gameplan_weekly.json` and `data/recruiting_weekly.json`.
- Added schemas for roster base, Gameplan weekly, and Recruiting weekly JSON.
- Moved situation controls onto Gameplan and package controls onto More.
- Added Gameplan-only and Recruiting-only JSON import/export controls.
- Added Top 3 alternatives directly below Best Call with play-art previews.
- Added Quick Tactical Summary, Game-Day Usage, and optional alerts.
- Expanded Personnel into Personnel & Matchups with run direction, protection, opponent defense, and matchup matrix sections.
- Updated Recruiting to use the shared roster base and hide diagnostic metadata from user-facing cards.
- Replaced validation with checks for the split-engine architecture.

## Data Integrity
- Preserved nulls from the video seed package.
- Did not invent missing roster, depth-chart, recruiting, coach-ability, or performance values.
