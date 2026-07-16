# CHANGELOG

## Staging-only CFB27 parser runtime refresh
- Added a reusable staging command: `python tools\cfb27_save_reader\refresh_dynasty.py --save-name DYNASTY-RUTGERSAPP`.
- Added parser runtime resolution for the locally built `leaguelines/cfb-dynasty` executable and isolated `C27_468_2.gz` schema directory.
- Added MVP parser export and normalization for season, teams, Rutgers roster, games, team season stats, injuries, and depth-chart sections when available.
- Confirmed the exact manual `DYNASTY-RUTGERSAPP` save is selected before autosaves, with explicit fallback warning support when the named save is missing.
- Added a guarded Rutgers app mapper framework that remains dry-run only and refuses production publishing until three-save parser validation passes.
- Added validation coverage for parser runtime metadata, exact-save selection, fallback warnings, nested rating ranges, and disabled publishing.
- Confirmed the latest staging parse found Rutgers stable team ID `78`, 85 Rutgers players, 12 schedule entries, 1 stats record, 12 injury records, and upcoming opponent UMass, while leaving production app JSON unchanged.

## Read-only CFB27 parser intake layer
- Added `tools/cfb27_save_reader/` as a standalone guarded parser wrapper for local CFB27 dynasty saves.
- Added save discovery, read-only snapshot copying, FBCHUNKS container inspection, parser diagnostics, experimental save comparison, and isolated tests.
- Added `data/dynasty/normalized/dynasty_normalized.schema.json` for the future parser-backed normalized Dynasty Hub contract.
- Added gitignore protections for parser runtimes, schema bundles, raw parser output, copied snapshots, and experiment outputs.
- Documented that this layer does not replace production JSON or promote comparison-derived values.

## Save-backed dynasty player decoder foundation
- Added `process_week.py --extract dynasty_players` to generate save-backed dynasty player schema outputs from the CFB27 `FBCHUNKS` dynasty save.
- Generated `dynasty_teams.json`, `dynasty_players.json`, `dynasty_player_stats.json`, `dynasty_depth_chart_candidates.json`, and `dynasty_decode_report.json` under `data/generated/dynasty/`.
- Confirmed the current save decodes Rutgers team identity while keeping Player, PlayerStatRecords, and depth-chart references blocked until binary row boundaries and player references are proven.
- Added candidate-only depth reference reporting for controlled save diffs; depth references are not promoted until they resolve to decoded Player rows.
- Added rating range validation so save-decoded ratings/attributes cannot exceed valid game ranges.
- Extended unit and project validation for save-backed player outputs, evidence coverage, candidate-only depth references, and non-promotion of unmapped data.

## Personnel profile stat completion
- Updated player profile season ribbons to use position-aware stat priority instead of the first visible stat fields.
- Confirmed M. York now shows verified season `YDS 1305` and `TD 11`, while season `INT` and `SACK` remain `N/A` because they are not present in the verified season source.
- Reworked roster hub tables to use position-aware verified attribute columns such as DL `PMV/FMV/PRC`, DB coverage columns, and QB passing ratings.
- Enlarged and cropped the fictional portrait area in premium player profiles and widened fact rows to prevent hometown/archetype label collisions.
- Added validation for M. York's season ribbon, Purdue DL roster attributes, and the updated portrait/fact-row treatment.

## Personnel roster, matchup, and player-card redesign
- Rebuilt player detail screens around a premium sports-profile hero with larger fictional portrait framing, team/position/class/overall identity, profile facts, and a scarlet `2025 Season Stats` ribbon before the tabbed details.
- Converted Team and Purdue Personnel sub-tabs into Home Team and Away Team roster hubs with team headers, Players/Team controls, team leader strips, phone-safe roster tables, position filters, and compact tap-through cards.
- Reordered Matchups so the top verified player matchup appears first, the next two roster/position matchups sit underneath it, and remaining player/roster matchups move into the All Matchups drill-down.
- Replaced the old bottom weekly roster grid with cleaner Home Team / Away Team browse cards that route into the roster hubs.
- Standardized unknown profile fields to `N/A` while keeping verified attributes, stats, traits, and matchup data source-bound.
- Expanded validation for premium player heroes, Home/Away roster hubs, opponent source-missing groups, matchup priority order, and the new roster-table contract.

## Verified data presentation recovery and analytics panels
- Changed Purdue player Traits tabs so source-missing development traits and abilities render as compact verified-source notes instead of stacked `N/A` rows.
- Added stricter verified-value handling so literal `N/A` source fields are not counted as verified traits.
- Added recruit detail-link status cards so board-only recruits clearly show `Needs verified detail link` while linked class/scouting records populate national rank, position rank, hometown, height, weight, and archetype.
- Reworked Stats Hub category rendering to show only verified tables by default and move unavailable categories into compact source-status notes.
- Made More > Analytics functional with Team Trends, Player Development, Opponent Tendencies, and Recruiting Analytics panels backed by existing verified data.
- Improved portrait crop, frame lighting, and source-bound presentation without replacing fictional assets or adding external photos.
- Expanded validation for Purdue trait source status, verified recruit profile fields, analytics panels, portrait polish, and empty Stats Hub category suppression.

## Phone UX and verified data presentation polish
- Added a verified-data summary to player detail Overview screens so source-backed ratings, traits, and stats are visibly acknowledged before optional profile gaps.
- Changed optional source-missing bio fields into a collapsed "Source fields not shown" note to reduce repeated `N/A` clutter on phone screens.
- Improved player Overview rating strips to use the best verified ratings available for each player instead of omitting visible attributes on some position groups.
- Tightened Stats Hub tables with verified-row counts, fewer default columns, smaller phone table widths, and extra bottom-navigation clearance.
- Added validation for verified-data summaries, collapsed source-missing profile fields, and phone-safe stat-table metadata.

## Verified player detail and Stats Hub repair
- Surfaced verified player ratings immediately on player detail Overview screens so players like J. Elijah show verified attributes instead of appearing data-empty.
- Grouped optional profile fields that are not visible in verified source evidence into a source-missing note instead of repeating `N/A` rows for every absent bio field.
- Replaced the Stats Hub `Team Snapshot` raw object preview with sports-app style leader strips and Passing, Rushing, Receiving, Defense, Turnovers, Third Down, Red Zone, and Kicking tables.
- Added validation that fails if verified player attributes render as missing or if the Stats Hub falls back to raw object/schema preview text.

## Rutgers home-team Gameplan dashboard
- Replaced the Gameplan main page coordinator stack with a Rutgers-first home dashboard.
- Added Rutgers snapshot, key offensive players, offensive depth chart, roster position groups, and quick-action routing on the Gameplan tab.
- Removed Run Game, Passing Game, Offensive Gameplan, Defensive Gameplan, Pressure, Coverage, and Protection cards from the Gameplan main page.
- Replaced the legacy Gameplan tab shell with a single home-dashboard mount so situation controls, Best Call, inline Top 3, quick summary, usage, alerts, opening script, opponent traits, and history panels no longer render on the main page.
- Polished the home dashboard for iPhone by separating snapshot labels/values, converting key offensive players into a horizontal swipe strip, tightening depth/roster text wrapping, and adding bottom-navigation clearance.
- Preserved the underlying weekly data, recommendation engine, Top Plays, Personnel, Recruiting, and weekly opponent package behavior.
- Updated validation and project standards so the Gameplan tab is checked as a home-team roster/depth dashboard instead of a coordinator report page.

## Recruiting and Personnel workspace polish
- Changed Recruiting Top 3 into a deterministic, horizontally scrollable Team Needs recommendation strip instead of a fixed first-three list.
- Updated Team Needs scoring to account for verified senior departures and explicit position-change fields only.
- Made recruit detail tabs usable and constrained Scouting/Fit to the requested field sets.
- Made Personnel matchup-first, moved weekly roster summaries to the bottom of the matchup view, and rebuilt Scout into defined opponent sections.
- Replaced the Stats accordion stack with a compact Rutgers/Purdue sports-stat dashboard for Last Game and Season views.
- Added validation for deterministic recruit Top 3, senior-driven Team Needs, recruit tab content, matchup-first Personnel, defined Scout, and revamped Stats.

## Random Top 3 and weekly roster matchups
- Locked Top Plays to the current 192 verified visible play inventory and removed the Best Play control from the Top Plays screen.
- Made `Generate Top 3` the primary Top Plays action, producing three unique pure-random plays from verified play IDs only.
- Rebuilt the Personnel overview around the weekly team roster and weekly opponent roster so future imported opponents can replace Purdue without hardcoded opponent assumptions.
- Added roster-vs-roster matchup cards for WR/CB, RB/MLB, OL/DT, TE/LB-S, QB/pressure, and opponent offensive groups when source data exists.
- Kept source-missing opponent position groups explicit instead of inventing QB/RB/WR/TE/OL rows for the current Purdue package.
- Added validation for locked 192-play random Top 3 generation and weekly roster matchup rendering.

## Gameplan main page coordinator layout
- Reworked the Gameplan landing page to show Executive Summary, Run Game, Passing Game, Protection, Defensive Gameplan, Pressure, and Coverage as the top-level coordinator flow.
- Removed Biggest Threat and Concise Alerts from the default Gameplan main-page flow so the requested first-page sections are not buried.
- Changed coordinator metric rows to a mobile-safe stacked layout to prevent overlapping green value text on iPhone widths.
- Added validation for the requested main-page card order and mobile-safe coordinator metric styling.

## Full video evidence recovery correction
- Rendered every current recruiting-board and four-star class recruit as `4★` based on the user-confirmed class evidence, while keeping all other recruit fields source-bound and non-inferred.
- Removed `Stars N/A` from recruit compact cards and recruit detail screens; validation now fails if a recruit card/detail drops the four-star marker.
- Tightened recruit detail hero layout so long names and status badges stay in a mobile-safe two-column sports profile layout instead of wrapping one character per line.
- Added a compact recruit hero badge for limited scouting states so verbose status text does not squeeze the player/recruit name column.
- Normalized Purdue detail evidence rendering across `video_evidence`, `evidence`, and `source_video` record shapes.
- Moved Purdue detail recommendations into a full-width callout to prevent label/value collision on phone layouts.
- Added validation coverage for Purdue detail evidence/callouts and recruit hero mobile safeguards.

## Full video evidence recovery
- Expanded the Purdue opponent browser beyond the original 16-player defensive-front package by promoting verified season-stat identities and recovered CB/K roster rows into normal opponent cards.
- Added Purdue position filters for QB, RB, WR, TE, OL, DL, LB, DB, and ST, with source-missing messaging for offensive groups not visible in the current evidence.
- Added Rutgers roster recovery data for verified development traits, physical abilities, mental abilities, QB attributes, identity fields, and evidence notes from roster frames and user screenshots.
- Added Purdue weekly opponent roster recovery data for visible LEDG, REDG, and CB attribute rows, including Q. Gillians' verified Workhorse/Hammer ability evidence.
- Added Rutgers prospect-board scouting recovery data for verified detail-screen recruits, including offensive line, safety, edge/ATH, and partial CB scouting states.
- Wired recovery overlays into existing player and recruit resolvers by stable `player_id` / `prospect_id` without changing recommendation logic or hardcoding Purdue as a permanent opponent.
- Added a player-detail Traits panel for development trait, physical abilities, mental abilities, and evidence notes.
- Added full video extraction, roster, opponent, stats, recruiting, count reconciliation, and card-population reports.
- Expanded validation to confirm recovered video values render instead of reverting to `N/A`.

## Sports-app player and recruit card redesign
- Replaced active Rutgers, Purdue, and recruit list cards with compact sports-app cards using portrait-left, data-center, badge-right, and bottom stat-strip structure.
- Added dedicated sports profile detail screens for Rutgers players, Purdue players, and recruits with hero sections, sticky detail tabs, separated Season and Last Game stats, and list back-navigation with scroll restoration.
- Added source-driven recruit star and gem rendering: current verified JSON contains no numeric star or gem fields, so the UI shows `Stars N/A` and no gem badge instead of inventing values.
- Added source-driven development-trait badges for compact player cards; current verified Rutgers/Purdue player data contains no dev-trait fields, so no trait badges are invented.
- Added sports-app screenshot capture at 390x844 and 430x932 for Rutgers player list/detail, Purdue roster/detail, Recruiting board/detail, and back-navigation restoration.
- Expanded validation for compact card layout consistency, hidden internal IDs, star/gem/dev-trait source ownership, dedicated detail screens, scroll restoration, screenshot artifacts, and static GitHub Pages favicon loading.

## Production binding and sports-app correction
- Added canonical recruit display-model resolution from the video-verified Rutgers board and four-star class packages.
- Converted Recruiting to sports-app compact cards, ranked Top 3 action rows, and dedicated recruit detail screens.
- Added full Purdue roster browser sourced from `data/video_verified/purdue_roster.json` with compact cards and dedicated opponent detail screens.
- Added `productionPlayRanking()` so Best Play and Top 3 share one deduped verified-play source.
- Added visible run-direction arrows and readable protection/status labels in compact Gameplan cards.
- Converted Rutgers roster lists to compact card-to-detail behavior.
- Added production binding validation, reports, and phone screenshots at 390x844 and 430x932.

## CFB27 video-only data package
- Added `data/video_verified/` JSON and static JS bundles for Rutgers season stats, Purdue season stats, Purdue roster, four-star freshman class, Rutgers prospect board, and the video-only evidence index.
- Added video-only data generation from the five supplied package videos with timestamp/frame evidence and explicit `N/A` fields.
- Updated static app loaders so video-only bundles are preferred when present.
- Added validation for video-only reports, bundle loading, timestamp evidence, unresolved identity count, card population counts, and loader usage.
- Added required video-only audit, N/A, extraction, card population, and regression reports.

## Complete video-to-JSON audit
- Added `data/audit/video_evidence_index.json` generation for every current Rutgers player, opponent player, recruit, verified visible play, and matchup.
- Added complete video/data recovery reports for Rutgers, opponent, recruiting, plays, remaining `N/A` rechecks, identity integrity, uniform card contracts, sports-app behavior, and final regression.
- Added validation for audit count parity, real-or-null timestamps, documented source-missing fields, zero unresolved joins, hidden visible internal IDs, and uniform player/recruit detail tab contracts.
- Removed visible production references to play IDs and matchup IDs in favor of play names and player-vs-player matchup labels.
- Added shared detail tab strips for player and recruit cards while preserving the current static GitHub Pages app architecture and recommendation logic.

## Identity join correction
- Added explicit identity join states for verified, source-missing, join-failed, and not-applicable data.
- Recovered the verified W. Boudreaux recruiting scouting record and bound it to the weekly board by canonical `prospect_id`.
- Updated RecruitCard rendering so recovered scouting attributes, abilities, mentals, development trait, and source-missing fields render from resolved display data.
- Added authoritative O-line depth-chart seed bindings for LT, LG, C, RG, and RT using canonical Rutgers `player_id` values.
- Added centralized player, prospect, media, stats, scouting, and depth-slot resolvers.
- Expanded validation to hard-fail failed joins, wrong attribute ownership, board-rank index fallback, generic O-line side guessing, and masked join failures.
- Added identity join audit reports for recruiting, W. Boudreaux, Rutgers depth chart, Rutgers player details, join-state validation, and regression.

## Identity linkage foundation
- Added canonical identity registries for players, prospects, and verified plays without duplicating ratings, attributes, stats, matchup grades, or recommendation scores.
- Added `data/migrations/identity_id_map.json` to audit preserved, created, or remapped IDs.
- Preserved existing stable Rutgers, opponent, prospect, and play IDs; added stat-only opponent identities for Purdue stat rows that are outside the 16-card opponent package.
- Expanded validation for duplicate IDs, missing IDs, unresolved foreign keys, roster/card count parity, media binding, stats binding, RecruitCard count parity, verified gem/development-trait handling, play recommendation linkage, matchup linkage, and 192-play preservation.
- Added identity audit reports for Rutgers players, recruits, plays, media, stats, matchups, play-player fit, and regression.

## Sprint 2.5 correction pass 2 tab ownership
- Locked the permanent tab ownership standard into `PROJECT_SPEC.md`.
- Moved Best Play, Top 3, Top Plays hero, Top 3 selector, filters, search, favorites, grouping, play art, and the full 192-play library fully under the Top Plays tab.
- Simplified Gameplan into concise offensive and defensive coordinator cards: executive summary, run game, passing game, protection, biggest threat, pressure, coverage, and alerts.
- Hid raw Rutgers-vs-opponent comparison wall cards from the Gameplan registry while preserving their source JSON for internal intelligence.
- Converted Recruiting list and action-plan rows to reusable `RecruitCard` rendering with controlled scheme-fit labels and no repeated generic instructions.
- Expanded validation for tab ownership, Gameplan card order, all-192 play reachability, Top Plays hero controls, registry ownership, and RecruitCard rendering.

## Sprint 2.5 premium native app experience
- Added PWA install metadata, manifest, and a local SVG app icon for static GitHub Pages delivery.
- Added a native application backdrop, premium gradient background, glass-card overrides, semantic design tokens, floating bottom navigation, page transitions, skeleton states, and reduced-motion support.
- Added tab scroll memory and smooth tab transitions without changing football recommendation, matchup, player, play, or JSON logic.
- Refactored permanent standards into `docs/DESIGN_SYSTEM.md`, `docs/JSON_STANDARD.md`, `docs/UI_COMPONENT_STANDARD.md`, `docs/VALIDATION_STANDARD.md`, and `docs/RELEASE_STANDARD.md`, with `PROJECT_SPEC.md` now indexing them.
- Captured before-and-after 390 x 844 screenshots for Gameplan, Personnel, Top Plays, Matchups, and Recruiting and referenced them in the Sprint 2.5 native UI report.
- Expanded validation for Sprint 2.5 design governance docs, native tokens, PWA wiring, animation, navigation, and screenshot artifacts.

## Sprint 2 Pack D gameplan intelligence engine
- Added `data/weekly/weekly_matchup_summary.json` and static bundle as the coordinator intelligence layer.
- Rebuilt the Gameplan tab into Offensive Gameplan and Defensive Gameplan sections.
- Added offensive executive summary, comparison table, Best Play Hero, Top Three selector, run game, passing game, protection, and alerts cards.
- Added defensive executive summary, comparison table, biggest threat, pressure, coverage, and alerts cards with limited-data handling for unsupported defensive data.
- Registered Pack D coordinator cards in `data/card_registry.json` without duplicating football values.
- Expanded validation for weekly matchup summary sections, comparison rows, play/player/matchup ID resolution, Top Three hero updates, static loading, and Pack A/B/C/Phase 1.2 regressions.

## Sprint 2 Pack C locked player/play/run logic
- Added weekly coaching-decision JSON and static bundle for JSON-driven run personnel.
- Added weekly run-lane analysis JSON and static bundle with explicit limited-data lane status.
- Locked Player Card rendering for Rutgers and opponent players, including Season Stats before Last Game and top-six default attributes.
- Locked Play Card rendering for Best Call, Top Plays, and Alternative Plays with play art, Why It Works, run lane/read, protection, situational fit, ball carrier/target, counter, and More Detail sections.
- Added JSON-driven recommended ball carrier resolution for run plays without hardcoding player names in the renderer.
- Added five-slot O-line card for LT, LG, C, RG, RT with matchup enrichment where available.
- Expanded validation for player cards, play cards, run personnel, run-lane limited-data behavior, 192-play regression, and Pack A/B/Phase 1.2 regression.

## Sprint 2 Pack B executive dashboard
- Converted the Gameplan/Home default experience into a registry-driven executive dashboard using the shared Pack A card primitives.
- Added dashboard registry entries for Game Header, Featured Player, Biggest Risk, tactical summary cards, Top Matchups Preview, Alerts, and Team Cards.
- Added reusable dashboard card renderers for team summaries, featured player, biggest risk, weekly tactical summaries, matchup preview, and alerts.
- Preserved Phase 1.2 matchup behavior, top-three matchup order, recommendation scoring, weekly package architecture, and GitHub Pages static compatibility.
- Expanded validation for Pack B registry coverage, dashboard order, dynamic player/risk resolution, tactical card data sources, raw object leakage, and matchup regression.

## Sprint 2 Pack A architecture foundation
- Added `PROJECT_SPEC.md` as the source-of-truth specification for future implementation requests.
- Added shared card primitives and reusable glossy card design tokens/classes.
- Added `data/card_registry.json` plus a static `data/card_registry.js` bundle for GitHub Pages loading.
- Added a card resolver layer that binds registry entries to existing matchup JSON by stable ID without mutating source data.
- Refactored the approved Key Matchup card path to use shared card primitives while preserving Phase 1.2 matchup semantics and mobile behavior.
- Expanded validation for project spec presence, registry schema, matchup ID resolution, no duplicated football data in the registry, shared card engine presence, resolver presence, and matchup regression.

## Phase 1.2 final semantic correction
- Corrected `MATCHUP EDGE` semantics so internal matchup scores are not displayed as advantage margins.
- Added explicit edge-display handling for verified differentials, advantage-only states, even states, and limited-data states.
- Reworked More Detail evidence into separate readable rows with metric, Rutgers value, opponent value, and edge/result.
- Expanded validation for internal-score suppression, verified differential behavior, advantage/even/limited states, evidence rows, and unchanged top-three ordering.

## Phase 1.2 matchup visual polish
- Rebuilt the expanded Key Matchup card hierarchy into a phone-first broadcast-style layout.
- Added dominant Rutgers/opponent player panels, larger portraits, and a central `MATCHUP EDGE` result panel.
- Limited default comparison rows to four verified metrics and moved remaining attributes/evidence/limitations into `More Detail`.
- Converted production into compact Last Game/Season mini-cards with collapsed `Limited data` states.
- Promoted the tactical recommendation into the final primary coaching callout.
- Strengthened glossy black/scarlet/gold styling while preserving mobile overflow safeguards and fixed bottom navigation.
- Expanded validation for visual hierarchy, central edge panel, selected-metric count, tactical callout, compact production, and static Pages compatibility.

## Phase 1.2 matchup card system
- Replaced `Personnel -> Match -> Key Matchups` with a reusable JSON-driven `MatchupCard(...)` component.
- Added top-three matchup ordering by priority/severity, confidence, matchup importance, and source order.
- Rendered exactly three valid Key Matchups by default when at least three valid rows exist.
- Reused the same matchup-card component for `All Matchups`.
- Added compact portrait thumbnails, priority badges, matchup edge, attribute comparison, separate production sections, and tactical result blocks.
- Added glossy black/scarlet/gold matchup styling with mobile overflow safeguards.
- Expanded validation for top-three selection, ID/media resolution, nullish/object leakage, one-open-card behavior, and GitHub Pages compatibility.

## Phase 1.2 correction pass
- Added a defensive nested-value formatter used by rows, cards, stats, matchups, and recruiting render paths to prevent `[object Object]`, `undefined`, and literal `null` leaks.
- Completed mobile-first Rutgers and opponent player cards with separated Last Game and Season production blocks plus limited-data indicators.
- Reworked expanded matchup cards into a mobile header, comparison table, production sections, and result block.
- Fixed Featured Player and Biggest Risk summaries so they render readable, tappable football summaries.
- Improved portrait framing, team-color border treatment, card spacing, and phone-width fallbacks.
- Filtered repeated generic recruiting descriptions from rendered cards while preserving prospect-specific summaries.
- Expanded validation with rendered fixtures, duplicate-description checks, mobile breakpoint checks, and raw-object leak detection.

## Phase 1.2 player card engine + executive UI polish
- Added static Rutgers and opponent player media registries with fictional SVG portraits bound by `player_id`.
- Added `player_card_registry.json` to bind card rendering to existing roster, stat, matchup, and opponent JSON without duplicating ratings.
- Added premium player cards with portraits, verified attributes, season stats, last-game stats, matchup summaries, recommended usage, notes, and expandable detail.
- Upgraded matchup cards with Rutgers/opponent portraits, overall, attributes, grade, confidence, evidence, and recommendations.
- Added compact O-line run/protection visualization with run arrows, protection arrows, double-team callouts, and chip-help callouts.
- Split Recruiting into `Recruiting Board` and `Prospect List` workspaces and added required prospect status fields without duplicated descriptions.
- Enhanced Top Plays with favorites, personnel grouping, existing search/filter support, and letter-grade display across all 192 verified Oregon combinations.
- Added sticky-header compression for a more executive phone-first layout while preserving fixed bottom navigation and Rutgers scarlet/black/white styling.
- Expanded validation for media binding, registry counts, portrait assets, responsive layout, static GitHub Pages compatibility, and JSON parsing.

## Phase 1 final implementation
- Integrated `PHASE1_CODEX_VERIFIED_DATA_PACKAGE.zip` as the current verified data source.
- Added Rutgers Last Game, Rutgers Season, opponent Last Game, and opponent Season stat files as separate scopes.
- Replaced Top Plays inventory with all 192 verified visible Oregon formation/play combinations.
- Preserved `complete_playbook_status = CANNOT_VERIFY_COMPLETE_FROM_THIS_VIDEO`.
- Added placeholder play art for all Oregon visible plays without removing any verified play.
- Bound Matchups to `player_matchups.json` with grade, confidence, evidence, recommendation, and limited-data messaging.
- Added O-line alignment view with LT/LG/C/RG/RT markers.
- Removed Purdue-specific fallback logic from application code; Purdue remains only current weekly data.
- Added Phase 1 validation, player binding, matchup, playbook, mobile, and limitations reports.

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

## Permanent Video Source-Of-Truth First Runnable Pass
- Added `process_week.py` with video discovery, FFmpeg/FFprobe resolution, manifest generation, screen inventory, reference-frame capture, playbook authority separation, evidence-bound generated JSON, and markdown reports.
- Added standard-library tests for scanning, classification, evidence contracts, deterministic helpers, and raw-video git protection.
- Extended validation for generated video manifests, screen dispositions, 192-play legacy preservation, playbook separation, evidence completeness, coach/player ability separation, and current-team/opponent separation.
- Added `.gitignore` protection for raw `input_videos/` captures while preserving `.gitkeep`.

## Roster + Stats Hybrid Review Extraction
- Added `--extract roster_stats` to generate review crops, review JSON, and CSV import files for Rutgers/Purdue roster and season-stat videos.
- Added optional Tesseract detection while keeping manual-review behavior when OCR is unavailable.
- Added validation for review package presence, crop evidence, and no unconfirmed value promotion.

## OCR Review Import Support

- Installed/detected Tesseract OCR support for roster/stat review crops.
- Added portable/system Tesseract resolver support.
- Added `process_week.py --apply-review` for confirmed-only promotion with crop evidence.
- Added validation and tests for review import safety.

## Structured OCR Draft Parser

- Added roster/stat OCR draft parsing into structured review rows.
- Added structured review CSV outputs beside raw OCR crop review files.
- Kept confirmed-only promotion and field-level evidence requirements intact.

## Full Roster Sweep

- Added `process_week.py --extract roster_sweep` for end-to-end Rutgers/Purdue roster video scanning.
- Added roster/player-card inventories and sweep report outputs.
- Added validation for full-duration coverage, deduped player records, team separation, and field-level evidence.
- Updated roster sweep to default to 4 fps and add dynamic burst frames around detected changes.
- Changed roster sweep identity ownership so the highlighted roster table row creates the player identity and side-card OCR can only enrich that roster-owned record.

## Dynasty Hub Save Reader Foundation

- Added direct CFB27 dynasty save-reader mode to `process_week.py`.
- Added local Dynasty Hub server entrypoint for serving static UI plus generated save JSON.
- Added generated dynasty source-truth validation and tests.
- Protected raw `DYNASTY-*` save files from Git.
