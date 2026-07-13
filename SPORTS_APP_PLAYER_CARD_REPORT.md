# Sports-App Player Card Report

Status: PASS

## Scope
- Rutgers compact player cards: 48 rendered.
- Purdue compact player cards: 16 rendered.
- Dedicated Rutgers player detail screens: PASS.
- Dedicated Purdue player detail screens: PASS.

## Card Contract
Every compact player card now uses the same sports-app structure:

1. Portrait and team badge on the left.
2. Player name, position, class, overall, and short role line in the center.
3. Matchup, confidence, or threat badge on the right.
4. Bottom stat strip with verified position-aware metrics.

No compact card renders a giant inline profile, full table, raw internal ID, or raw JSON key.

## Source Ownership
- Ratings, positions, class, stats, and attributes continue to resolve from existing authoritative JSON.
- Development-trait badges are source-driven. Current verified Rutgers/Purdue player JSON has 0 verified development-trait fields, so no development-trait badge is invented.

## Validation
- `node --check app.js`: PASS
- `node --check tools/validate.js`: PASS
- `node tools/validate.js`: PASS
- Sports-app screenshot artifacts at 390x844 and 430x932: PASS
