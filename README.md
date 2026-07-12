# Rutgers Gameday Gameplan

Phone-first Rutgers game-day call sheet with a statistical recommendation engine, play art, shared roster foundation, and separate Gameplan and Recruiting weekly packages.

## Run / Open

### Windows
1. Open this folder.
2. Double-click `index.html`, or serve it locally with `python -m http.server 8000` and open `http://127.0.0.1:8000/`.

### iPhone
1. Push or copy the folder to GitHub Pages, or run a local server on Windows.
2. Open the GitHub Pages URL or local network URL in Safari.
3. Use the bottom navigation: Gameplan, Top Plays, Personnel, Recruiting, More.

## Weekly JSON Files

- `data/gameplan_weekly.json`: Gameplan-only weekly package.
- `data/recruiting_weekly.json`: Recruiting-only weekly package.
- `data/rutgers_roster_base.json`: shared Rutgers roster foundation used by both engines.

Use More to import/export Gameplan JSON or Recruiting JSON. The app validates package type before replacing any current package.

## Schemas

- `GAMEPLAN_WEEKLY_SCHEMA_v2.json`
- `RECRUITING_WEEKLY_SCHEMA_v2.json`
- `ROSTER_BASE_SCHEMA.json`

## Output / Report Files

- `VALIDATION_REPORT.md`: automated validation results.
- `ENGINE_ARCHITECTURE.md`: data and engine ownership map.
- `ROSTER_BASE_IMPORT_REPORT.md`: source and unresolved roster details.
- `GAMEPLAN_ENGINE_VALIDATION.md`: Gameplan validation summary.
- `RECRUITING_ENGINE_VALIDATION.md`: Recruiting validation summary.
- `MOBILE_VALIDATION_REPORT.md`: mobile layout validation summary.
- `CHANGELOG.md`: implementation changes.

## Current Limitations

The video seed package marks the full roster/depth chart as manual transcription required. Only verified structured values are imported. Unreadable player, prospect, depth-chart, coach-ability, and performance fields remain null or display as Not available / Unknown.
