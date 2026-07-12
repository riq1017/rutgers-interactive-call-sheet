# Rutgers Gameday Gameplan

Premium mobile Rutgers football coaching dashboard for Gameplan, Top Plays, Personnel & Matchups, Recruiting, and More.

## Open

### Windows
Open `index.html`, or run a static server from this folder:

```powershell
python -m http.server 8000
```

Then open `http://127.0.0.1:8000/`.

### iPhone
Use the GitHub Pages URL or a local network static-server URL. The app uses relative paths and does not require a build step.

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
- `RECRUITING_VALIDATION_REPORT.md`
- `MORE_PAGE_VALIDATION_REPORT.md`
- `MOBILE_VALIDATION_REPORT.md`

Screenshots are in `screenshots/`.

## Limitations

The enriched package does not include verified per-lane rushing attempts/yards, per-gap pressure counts, detailed O-line stat grids, full last-game stat grids, or full season stat grids. Those fields are hidden rather than fabricated.
