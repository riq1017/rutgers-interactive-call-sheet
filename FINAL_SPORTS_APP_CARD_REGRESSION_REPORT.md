# Final Sports-App Card Regression Report

Status: PASS

## Preserved
- Rutgers scarlet, black, and white visual system.
- Current statistical recommendation engine.
- Down-and-distance eligibility.
- Player-play fit scoring.
- Recent-call penalties.
- Setup bonuses.
- Top 3 diversity.
- Weekly JSON import/export.
- LocalStorage history.
- GitHub Pages static compatibility.

## Counts
- Rutgers compact player cards rendered: 48.
- Purdue compact player cards rendered: 16.
- Active recruit compact cards rendered: 35.
- Video-verified recruit detail records available: 62.
- Verified numeric recruit star fields: 0.
- Verified recruit gem fields: 0.
- Verified player development-trait fields: 0.

## Screenshots
Generated:

- `screenshots/sports_app_cards_390x844/`
- `screenshots/sports_app_cards_430x932/`

Each directory contains all required sports-app card screenshots.

## Validation
- `node --check app.js`: PASS.
- `node --check tools/validate.js`: PASS.
- `node --check tools/capture_sports_app_card_screenshots.js`: PASS.
- `node tools/validate.js`: PASS.

Overall regression result: PASS.
