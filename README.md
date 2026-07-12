# Rutgers Interactive Gameday Call Sheet

Mobile-first Rutgers football operations app for Gameplan, Top Plays, Personnel, Recruiting, and package management.

## Run

Open `index.html` directly, or serve the folder with any static server:

```powershell
python -m http.server 8000
```

Then open `http://127.0.0.1:8000/`.

The app is GitHub Pages compatible and uses relative static files only.

## Phase 1 Data

Rutgers is the permanent base team. Weekly opponent files are replaceable data.

Verified Phase 1 files in `data/`:

- `rutgers_roster_base.json`
- `rutgers_last_game_stats.json`
- `rutgers_season_stats.json`
- `opponent_last_game_stats.json`
- `opponent_season_stats.json`
- `player_matchups.json`
- `OREGON_PLAYBOOK_VISIBLE_TRANSCRIPT_VERIFIED.json`
- `PHASE1_DATA_PACKAGE_MANIFEST.json`

Static loaders:

- `data/rutgers_playbook.js` imports all 192 verified visible Oregon formation/play combinations.
- `data/phase1_verified_data.js` exposes Phase 1 JSON for GitHub Pages.
- `data/engine_data.js` preserves the existing static package architecture.

## Validation

```powershell
node --check app.js
node --check tools\validate.js
node --check data\rutgers_playbook.js
node --check data\phase1_verified_data.js
node tools\validate.js
```

Required Phase 1 reports:

- `PHASE1_FINAL_VALIDATION_REPORT.md`
- `PLAYER_DATA_BINDING_REPORT.md`
- `PLAYER_MATCHUP_VALIDATION_REPORT.md`
- `OREGON_PLAYBOOK_INTEGRATION_REPORT.md`
- `MOBILE_VALIDATION_REPORT.md`
- `KNOWN_LIMITATIONS.md`
- `VALIDATION_REPORT.md`

## Current Limits

- Oregon playbook status remains `CANNOT_VERIFY_COMPLETE_FROM_THIS_VIDEO`.
- All 192 Oregon visible plays use placeholder art until verified play diagrams are supplied.
- Opponent offensive roster and some defensive-back attributes are unavailable in the supplied package.
- Matchups with incomplete evidence display `LIMITED DATA`.
- Missing values are hidden rather than invented.
