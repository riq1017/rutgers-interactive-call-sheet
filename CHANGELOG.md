# CHANGELOG

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
