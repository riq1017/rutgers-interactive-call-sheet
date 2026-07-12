# CHANGELOG

## Live enriched dashboard implementation
- Integrated `Rutgers_ENRICHED_DESCRIPTIONS_JSON_Package.zip` as the authoritative data source.
- Replaced sparse roster/recruiting/Purdue data with enriched JSON files.
- Regenerated `data/engine_data.js` so GitHub Pages can load all enriched data without fetch calls.
- Added adapter functions for Rutgers roster, Gameplan weekly, Recruiting class, Recruiting weekly, team needs, Purdue profile, Purdue players, Purdue groups, and matchups.
- Rebuilt Gameplan, Top Plays, Personnel & Matchups, Recruiting, and More renderers around enriched data.
- Preserved the existing recommendation engine, play art, play mappings, recent-call penalties, setup bonuses, Top 3 diversity, localStorage history, and two-import workflow.
- Added iPhone-width screenshots for all five tabs under `screenshots/`.
- Expanded validation to enforce enriched data binding, hidden nulls, no placeholder names, no mockup fake data, play-art continuity, and mobile/GitHub Pages compatibility.

## Data policy
- Did not copy fake names, ratings, faces, or stats from the mockup.
- Did not invent unavailable lane, pressure, O-line, last-game, or season metrics.
- Null fields are hidden in normal UI.
