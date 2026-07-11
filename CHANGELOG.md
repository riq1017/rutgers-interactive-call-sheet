# CHANGELOG

## Rutgers Gameday Gameplan Interface

- Redesigned the existing Rutgers Interactive Call Sheet shell into a Gameday Gameplan interface while preserving the current statistical recommendation engine.
- Added a data-driven header for week/opponent, season record, Rutgers rank, offense rank, defense rank, and momentum status.
- Added a phone-first situation panel for down, distance, field zone, game state, quarter, time, score, tempo, Call Best Play, and Show Top 3 Plays.
- Added weekly package status for active opponent package, last updated value, package options, and existing weekly JSON import/export.
- Rebuilt the Best Call presentation to show rank, play, formation, concept family, risk, score, diagram fallback, fit metrics, history metrics, verified players, why-this-play text, and expandable score breakdown.
- Added sticky bottom navigation for Gameplan, Top Plays, Personnel, Scouting, and More without changing the weekly package architecture.
- Added weekly metadata in `data/weekly_plan.js` so visible header/package values are loaded from data files and missing values display as `Not available`.
- Expanded validation for the Gameday UI contract, mobile overflow protection, bottom navigation, Best Call card fields, score explanations, diagram fallback, and browser smoke behavior.

## Corrected Rutgers Video Data Integration

- Replaced stale Rutgers player names, positions, depth roles, overalls, visible attributes, usage profiles, and player-fit inputs with the corrected video-derived package data.
- Replaced the stale 69 OVR generic quarterback profile with M. York at 77 OVR and verified visible attributes from the correction report.
- Added corrected Rutgers last-game production for quarterbacks, backs, receivers, tight ends, and specialty usage from the supplied player-stat video.
- Removed restored display reliance on `Name unverified`, generic WR/TE labels, and stale placeholder player names where verified names exist.
- Added `docs/DATA_CORRECTION_REPORT.md` to document the corrected video source.
- Preserved the statistical recommendation engine, eligibility rules, player-play fit scoring, recent-call penalties, setup bonuses, Top 3 diversity, weekly import/export, localStorage history, and Rutgers UI.
- Expanded validation to confirm corrected player data, verified usage names, play-to-player references, missing-value display, and stale-data rejection.

## Statistical Recommendation Engine Upgrade

- Added hard eligibility filtering before scoring so matchup and red-zone bonuses cannot force invalid calls.
- Added complete play metadata for down, distance, field zone, game state, line-to-gain capability, primary/secondary positions, required attributes, and risk level.
- Added 4th-down logic for short yardage, medium yardage, and 7+ yard calls, including red-zone long-yardage restrictions.
- Added debug exclusion reasons for invalid down, distance, line-to-gain, field-zone, and game-state mismatches.
- Reworked scoring sequence to use baseline, Rutgers personnel fit, opponent matchup, season production, recent form, situation fit, setup/sequencing, recent-call diversity, and risk penalty.
- Added modifier caps from the weekly package and final 0-100 score clamping.
- Added primary player, secondary option, target/ball-carrier assignment, workload role, matchup rationale, objective, and plain-English explanation for every recommendation.
- Replaced generic displayed player labels with verified names where available and explicit `Name unverified` / `Not available` where source data is missing.
- Expanded weekly data architecture with Rutgers player records, available player attributes/stats, opponent personnel/stat fields, matchup traits, modifier caps, roles, triggers, and warnings.
- Improved Usage tab with collapsible mobile player categories and richer player cards.
- Expanded automated validation for 4th-and-long red-zone behavior, long-yardage restrictions, eligibility-only Top 3, player assignment, missing-stat handling, modifier caps, result-history persistence, and weekly-data-driven recommendation changes.

## Adaptive Recommendation Engine

- Added recent-call memory in `localStorage` with an 8-call window separate from result history.
- Added exact-play repetition penalties for the last play, last 3 calls, and last 6 calls.
- Added concept-family rotation across inside run, outside run, option, RPO, quick pass, intermediate pass, deep pass, screen, and play action.
- Added setup bonuses from successful inside runs, screens, quick passes, failed deep passes, and sacks.
- Added drive-context modifiers for 1st down, 2nd and short, 3rd and medium, red zone, protect lead, and must score.
- Added Top 3 diversity logic so recommendations include multiple concept families when possible.
- Added visible scoring breakdowns for base score, matchup modifier, situation modifier, recent-call penalty, setup bonus, risk penalty, and final score.
- Preserved weekly package import/export, existing local result logging, Rutgers design, and separated data files.
- Expanded `tools/validate.js` with behavioral tests for repetition, family rotation, setup bonuses, diverse Top 3, and context-sensitive rankings.
- Regenerated `VALIDATION_REPORT.md`.

## Hardened Rutgers Interactive Call Sheet

- Preserved the Rutgers scarlet/black/white phone-first UI and extended the existing call-card flow instead of rebuilding the interface.
- Added static no-JavaScript Purdue fallback content in `index.html`.
- Added weekly JSON export and import controls backed by a separate `localStorage` key.
- Added validation for imported weekly packages, including 12 unique valid opening-script play IDs.
- Expanded result logging with yards, sack, turnover, explosive, third-down conversion, and red-zone touchdown fields.
- Kept recent-history ranking modifiers capped from -6 to +6.
- Normalized UI-only situations such as backed up, fringe, and protect lead into existing playbook buckets without adding new unverified football data.
- Added repeatable validation script at `tools/validate.js`.
- Updated `README.md` with iPhone and Windows instructions, weekly workflow, output behavior, validation, and limitations.
- Regenerated `VALIDATION_REPORT.md` from the validator.
