# Rutgers Gameday Gameplan

Premium mobile Rutgers football coaching dashboard for Gameplan, Top Plays, Personnel & Matchups, Recruiting, and More.

## Open

### Windows
Open `index.html`, or run a static server from this folder. If `python` is not on PATH, use any simple static server.

```powershell
python -m http.server 8000
```

Then open `http://127.0.0.1:8000/`.

### iPhone
Use the GitHub Pages URL, or serve this folder from Windows and open the computer's local-network URL in Safari. The app uses relative paths and does not require a build step.

Direct phone QA links:

- `index.html?tab=personnel&personnel=rutgers`
- `index.html?tab=personnel&personnel=run`
- `index.html?tab=personnel&personnel=protection`
- `index.html?tab=personnel&personnel=matchups`
- `index.html?tab=recruiting`

## Data Sources

Authoritative enriched files are in `data/`:

- `rutgers_roster_base.json`
- `gameplan_weekly.json`
- `recruiting_class.json`
- `recruiting_weekly.json`
- `team_needs.json`
- `coach_recruiting_modifiers.json`
- `purdue_opponent_profile.json`
- `purdue_opponent_players.json`
- `purdue_opponent_position_groups.json`
- `purdue_matchups.json`
- `APP_DATA_BINDING_REQUIREMENTS.json`

`data/engine_data.js` wraps those JSON files for static GitHub Pages loading.

## Data Binding

- Personnel cards render from `rutgers_roster_base.json`.
- Opponent header, opponent cards, position groups, and matchup cards render from the active weekly gameplan package and linked opponent JSON.
- Recruiting overview renders from `recruiting_weekly.json`.
- Prospect cards render from `recruiting_class.json`, linked by stable `prospect_id` where available.
- Missing values are hidden; the app does not invent ratings, faces, names, lane stats, pressure counts, last-game stats, or season stats.

## Validation

```powershell
node --check app.js
node --check tools\validate.js
node tools\validate.js
```

Reports:

- `VALIDATION_REPORT.md`
- `GAMEPLAN_VALIDATION_REPORT.md`
- `TOP_PLAYS_VALIDATION_REPORT.md`
- `PERSONNEL_MATCHUPS_VALIDATION_REPORT.md`
- `RUN_DIRECTION_VALIDATION_REPORT.md`
- `PROTECTION_VALIDATION_REPORT.md`
- `OPPONENT_VALIDATION_REPORT.md`
- `MATCHUP_VALIDATION_REPORT.md`
- `RECRUITING_VALIDATION_REPORT.md`
- `MORE_PAGE_VALIDATION_REPORT.md`
- `MOBILE_VALIDATION_REPORT.md`

Screenshots are in `screenshots/`.

## Limitations

The enriched package does not include verified per-lane rushing attempts/yards, per-gap pressure counts, detailed O-line stat grids, full last-game stat grids, or full season stat grids. Those fields are hidden rather than fabricated.
