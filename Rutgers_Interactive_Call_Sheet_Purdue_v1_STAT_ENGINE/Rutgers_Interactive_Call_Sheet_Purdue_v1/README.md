# Rutgers Interactive Phone Call Sheet

This is the permanent Rutgers phone-first call-sheet baseline. Purdue is the first weekly opponent package, not the app identity.

## Open on iPhone

Option 1, local file:
1. Unzip the package.
2. Save the unzipped folder to iCloud Drive, Files, or another location available on the phone.
3. Open `index.html` in Safari.
4. Keep the whole folder together so `styles.css`, `app.js`, and `data/` remain beside `index.html`.

Option 2, simple static hosting:
1. Put the unzipped folder on any static host.
2. Open the hosted `index.html` URL in Safari.
3. Use Add to Home Screen if you want a phone-app style launcher.

If JavaScript is disabled, the page shows a static Purdue fallback with the opening 12 and matchup traits.

## Open on Windows

1. Unzip the package.
2. Double-click `index.html`, or right-click and open it in Edge/Chrome.
3. For validation, open PowerShell in the folder and run:

```powershell
node tools\validate.js
```

No backend is required.

## Data separation

- Permanent app shell: `index.html`, `styles.css`, `app.js`
- Permanent Rutgers playbook: `data/rutgers_playbook.js`
- Weekly Rutgers team/source anchors: `data/rutgers_team.js`
- Weekly opponent package: `data/weekly_plan.js`
- Local game history: `data/game_history.js` loads from browser `localStorage`

Purdue data can be replaced independently by importing a new weekly JSON package or replacing `data/weekly_plan.js`.

## Weekly JSON import/export

Use `EXPORT WEEKLY JSON` to save the active weekly package. Use `IMPORT WEEKLY JSON` to load a replacement package on the phone or Windows. Imported packages are stored in `localStorage` under a separate weekly-package key and do not modify the playbook, Rutgers team file, or result history.

A weekly package must include:
- `opponent`
- `traits`
- `familyModifiers`
- `riskRules`
- `openingScript`
- `usage`
- `warnings`

The opening script must contain 12 unique play IDs that exist in `data/rutgers_playbook.js`.

## Result logging

Each ranked play can log:
- result: success, neutral, or failure
- yards
- sack
- turnover
- explosive
- third-down conversion
- red-zone touchdown

Recent history modifies rankings, but the modifier is capped from -6 to +6.

## Ranking formula

Final score = baseline play score + opponent-family modifier + capped recent-result modifier + situation bonus - risk penalty.

Purdue week promotes inside runs, RPOs, screens, and quick answers. Deep slow-developing calls are penalized.

## Validation

Run:

```powershell
node tools\validate.js
```

The script writes `VALIDATION_REPORT.md` and checks play IDs, opening-script references, situation coverage, fallback content, weekly import/export hooks, richer result logging fields, history cap, mobile layout hooks, Purdue traits, promoted/penalized families, localStorage persistence, and source-rating guardrails.

## Current limitations

- The playbook is a starter inventory from visible playbook frames.
- No new ratings should be added unless visible in source evidence.
- The app stores local result history per browser/device.
- Static fallback is read-only.
- This app does not upload directly to a console or game.
