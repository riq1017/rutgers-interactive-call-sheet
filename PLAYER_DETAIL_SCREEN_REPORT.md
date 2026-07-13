# Player Detail Screen Report

Status: PASS

## Implemented
Rutgers and Purdue compact player cards now open dedicated profile screens instead of inline expansion.

Each player detail screen includes:
- Sports profile hero.
- Portrait.
- Name.
- Team treatment.
- Position.
- Class.
- Overall.
- Height and weight when present.
- Depth, weekly role, or threat role when present.
- Detail tab strip: `Overview | Attributes | Stats | Matchups | Plays`.

## Stats Order
Stats remain separated and ordered:

1. Season
2. Last Game

## Navigation
Back actions return to the roster or opponent list and restore the saved scroll position.

## Validation
- Rutgers player detail screens: PASS.
- Purdue player detail screens: PASS.
- Back-navigation helper binding: PASS.
- Scroll restoration helper binding: PASS.
