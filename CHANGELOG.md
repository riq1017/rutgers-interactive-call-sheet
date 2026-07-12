# CHANGELOG

## Mobile correction pass
- Removed remaining 390px shell caps so the app uses the full phone viewport with 8-10px page padding.
- Collapsed Gameplan secondary sections and compressed the global header so the first phone viewport reaches Best Call.
- Replaced the Roster long list with horizontal position boxes and single-group compact player rows.
- Added Personnel Scouting Report as its own internal section.
- Reworked Matchups into compact player-vs-player cards when the weekly matchup row resolves to verified players.
- Split Last Game and Season stat sheets into separate toggles with required categories and no invented values.
- Bound Recruiting to the imported weekly `active_board` first, with class-record enrichment only when IDs resolve.
- Added accessible visual star rendering that hides unavailable star ratings.
- Regenerated validation and 390x844 screenshot artifacts for the correction pass.

## Mobile UI compaction pass
- Compressed Gameplan defaults so Best Call appears in the first phone screen with full breakdowns behind tap-open details.
- Moved secondary situation fields into a More Context drawer.
- Reworked Top Plays into compact rows with an Advanced Filters drawer.
- Converted Personnel into an internal workspace with one visible subsection at a time.
- Converted roster, O-line, opponent, matchup, run direction, and protection detail into compact tap-open rows/cells.
- Reworked Recruiting into a dashboard with compact overview, priority chips, top actions, board rows, and advanced filter drawer.
- Converted More secondary groups into compact accordions.
- Added `UI_COMPACTION_VALIDATION_REPORT.md`.

## Personnel and recruiting correction pass
- Removed remaining hardcoded opponent language from visible gameplan, Personnel, matchup rationale, More, and no-JavaScript fallback surfaces.
- Added dynamic opponent/week helpers so imported weekly packages drive the current opponent label.
- Completed Personnel subsection routing with `?tab=personnel&personnel=rutgers|run|protection|matchups`.
- Updated Run Direction and Protection panels to bind names and recommendations from active weekly opponent and matchup data while hiding unavailable metrics.
- Wrapped segmented controls and constrained the sticky header/bottom nav to the phone shell to prevent iPhone-width horizontal clipping.
- Linked weekly recruiting action rows to prospect records by `prospect_id` when detail exists.
- Added focused Run Direction, Protection, Opponent, and Matchup validation reports.
- Regenerated required 390x844 iPhone screenshots.

## Live enriched dashboard implementation
- Integrated `Rutgers_ENRICHED_DESCRIPTIONS_JSON_Package.zip` as the authoritative data source.
- Replaced sparse roster/recruiting/Purdue data with enriched JSON files.
- Regenerated `data/engine_data.js` so GitHub Pages can load all enriched data without fetch calls.
- Added adapter functions for Rutgers roster, Gameplan weekly, Recruiting class, Recruiting weekly, team needs, Purdue profile, Purdue players, Purdue groups, and matchups.
- Rebuilt Gameplan, Top Plays, Personnel & Matchups, Recruiting, and More renderers around enriched data.
- Preserved the existing recommendation engine, play art, play mappings, recent-call penalties, setup bonuses, Top 3 diversity, localStorage history, and two-import workflow.
- Added iPhone-width screenshots for all five tabs under `screenshots/`.
- Expanded validation to enforce enriched data binding, hidden nulls, no placeholder names, no mockup fake data, play-art continuity, and mobile/GitHub Pages compatibility.

## Data policy
- Did not copy fake names, ratings, faces, or stats from the mockup.
- Did not invent unavailable lane, pressure, O-line, last-game, or season metrics.
- Null fields are hidden in normal UI.
