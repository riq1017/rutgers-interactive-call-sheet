# Rutgers Codex Data Package

Use this package as structured input for the Gameday Gameplan recruiting module.

## Files

- `data/team_needs.json` — exact values transcribed from the supplied Team Needs screenshot.
- `data/recruits.json` — prospect names and position groups that were clearly readable from the recruiting-board video.
- `data/roster.json` — clearly readable roster values plus an index of extracted roster frames.
- `data/recruiting_settings.json` — editable initial priority weights.
- `reference_frames/` — sampled source frames for Codex/manual review.

## Critical data rule

Do not fabricate missing fields. `null` means the value was not shown clearly enough to verify. Preserve `verification_status` and source-frame references.

## Implementation rule

The in-game Team Needs values are only one input. Final recruiting priority must combine roster need, current team performance, future depth risk, scheme fit, talent upgrade potential, board coverage, interest, pipeline, cost, and signing feasibility.

## Manual review

The roster video contains more players than the confidently transcribed subset in `roster.json`. Use the included roster reference frames to expand the file, but leave unclear names or ratings as `null` and flag them for review.
