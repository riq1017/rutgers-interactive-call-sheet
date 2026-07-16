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

## Permanent Video Source-Of-Truth Intake
Place weekly CFB27 source videos in `input_videos/`. Raw videos are ignored by Git; keep `input_videos/.gitkeep` committed. Run `python process_week.py --dry-run` to classify videos, then `python process_week.py` to generate evidence-bound JSON under `data/generated/`, reference frames under `assets/reference_frames/`, and reports under `reports/`.

Supported commands:
- `python process_week.py --force`
- `python process_week.py --video "Purdue Season Stats.mp4"`
- `python process_week.py --dry-run`
- `python process_week.py --review`

The first runnable pass inventories screens and marks OCR-dependent values for manual review. Legacy JSON is comparison-only when video-backed evidence exists.

## Roster + Stats Review Extraction
Run `python process_week.py --extract roster_stats` to generate OCR-ready crops for Rutgers/Purdue roster and season-stat videos. Crops are written to `assets/review_crops/`; review JSON/CSV files are written to `data/generated/review/`. If Tesseract is unavailable, values remain `null` and `manual_review: true`.

## OCR Review Import Workflow

Tesseract OCR is optional but now supported by `process_week.py`. Detection order is `TESSERACT_EXE`, `video_tools.local.json`, PATH, common Windows installs, then `tools/portable/tesseract/`. Run `python process_week.py --extract roster_stats` to create review crops and OCR drafts. Only rows marked `confirmed` are promoted by `python process_week.py --apply-review`; unknown or unconfirmed values remain out of source-truth JSON and display as `N/A`.

### Structured OCR Draft Review

`python process_week.py --extract roster_stats` now keeps raw OCR crop text and also writes structured draft rows to `data/generated/review/*_structured_review.csv`. These rows are easier to confirm because each candidate field carries crop evidence and starts as `ocr_draft_needs_confirmation`.

### Full Roster Sweep

Run `python process_week.py --extract roster_sweep --force` to scan the complete Rutgers and Purdue roster videos at 4 fps, add burst samples around roster/card/table changes, dedupe unique roster/player-card appearances, and write merged player records with crop-level evidence. The highlighted roster table row is the primary identity source; side-card OCR may enrich that player record, but it cannot create a new player identity. The approved UI is not modified by this command.

## Local Dynasty Hub Save Reader

Run `python process_week.py --extract dynasty_save` to read the local CFB27 dynasty save and generate `data/generated/dynasty/` JSON. Run `python dynasty_server.py --refresh` to refresh the generated data and serve the static hub locally at `http://127.0.0.1:8765`. Raw `DYNASTY-*` save files must stay local and are ignored by Git.

## Read-Only CFB27 Parser Intake

The guarded parser wrapper lives in `tools/cfb27_save_reader/`. It is separate from `process_week.py` and never edits the live save.

```powershell
python tools\cfb27_save_reader\locate_save.py --save-name DYNASTY-RUTGERSAPP
python tools\cfb27_save_reader\inspect_save.py --save-name DYNASTY-RUTGERSAPP
```

The reader copies the source save into `data/dynasty/snapshots/`, verifies matching SHA-256 hashes, inspects only the copied file, and writes parser diagnostics under `data/dynasty/inspection/`. Parser binaries, schema bundles, copied snapshots, and raw parser JSON stay local and gitignored. Production JSON is not replaced by this command.
