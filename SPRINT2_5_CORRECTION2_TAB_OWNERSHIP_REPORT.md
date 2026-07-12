# Sprint 2.5 Correction 2 Tab Ownership Report

## Summary
- PASS - `PROJECT_SPEC.md` now defines the permanent tab responsibility standard.
- PASS - Gameplan owns only coordinator-level executive summaries, concise phase cards, pressure/coverage/threat cards, and alerts.
- PASS - Top Plays owns Best Play, Top 3, hero/selector, filters, search, favorites, grouping, play art, and the full verified play library.
- PASS - Personnel remains the roster, player-card, depth, O-line, matchup, and scouting workspace.
- PASS - Recruiting owns prospect cards, board state, scheme fit, projected role, recruiting value, and player-specific recruiting intelligence.

## Gameplan Restrictions
- Removed normal rendering of the full Top Plays library from Gameplan.
- Removed Best Play and Top 3 selector ownership from Gameplan.
- Removed raw Rutgers Offense vs Opponent Defense and Rutgers Defense vs Opponent Offense comparison walls from Gameplan.
- Preserved the underlying weekly matchup JSON for internal summaries and future traceability.

## Registry Updates
- `best_play_hero` tab owner changed to `topplays`.
- `top_three_selector` tab owner changed to `topplays`.
- `offensive_comparison_table` and `defensive_comparison_table` are hidden from default Gameplan rendering.
- `recruit_card_collection` was added for reusable recruiting-card ownership.

## Validation
- `node --check app.js`: PASS
- `node --check tools/validate.js`: PASS
- `node tools/validate.js`: PASS
