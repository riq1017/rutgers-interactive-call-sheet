# PROJECT_SPEC

Future implementation requests must begin with: `Read PROJECT_SPEC.md before implementation.`

## A. Product Identity

Rutgers Interactive Call Sheet is the current implementation of the Rutgers Gameday Gameplan mobile app. The frozen Phase 1.2 baseline is commit `f6cb85f0fbb4bfa3c84fbeee5c4bac270282904a`.

The product intent is a mobile-first game-day operating system for weekly call-sheet recommendations, verified roster/personnel review, opponent matchup review, recruiting board management, and static GitHub Pages publishing. Coach-career and dynamic-program support are future architecture targets only; Rutgers is the current active program.

No fabricated football data is allowed. If source data is unavailable, the app must show `Limited data`, hide the field, or document the limitation.

## B. Source-Of-Truth Hierarchy

JSON owns football data. Card components own presentation. The card registry owns card placement, order, priority, visibility, and display variants only.

Roster JSON owns player identity. Media JSON owns portrait and media bindings. Last-game JSON and season JSON remain separate. Matchup JSON owns matchup selection, evidence, confidence, and tactical intelligence. The weekly opponent package remains replaceable. Playbook JSON owns verified visible play combinations.

No registry or media file may duplicate football ratings, stats, names, matchup results, play recommendations, recruiting values, or tactical claims.

## C. Card Standards

Shared cards must support compact and expanded states, title/subtitle, badges, portraits/media, metric rows, stat sections, source status, actions, priority variants, and size variants.

The approved design language is glossy black with Rutgers scarlet and opponent gold accents, subtle sheen, thin reflective borders, rounded corners, and strong phone readability. One-open-card behavior is required where detail accordions share a list. Horizontal overflow is not allowed.

Raw object rendering is forbidden. UI must never display `[object Object]`, `undefined`, or literal `null`. Missing data displays as `Limited data`.

Player detail screens must surface verified ratings and production before optional bio gaps. Optional fields such as height, weight, jersey, hometown, or archetype may be hidden or grouped as source-missing when no verified source contains them, but verified attributes and stats must not render as `N/A`.

Player detail screens use the sports-profile presentation pattern: larger source-bound fictional portrait treatment, team/position/class/overall identity, profile facts, a scarlet season-stat ribbon, then tabbed Overview, Attributes, Traits, Stats, Matchups, and Plays content. The season-stat ribbon must prioritize position-relevant season production, such as QB yards and touchdowns before completion metadata. Unknown source fields render as `N/A`; they must not be inferred or silently replaced with guessed data.

Stats views must use structured sports tables or stat strips. Whole JSON objects, schema metadata, source metadata, or semicolon-style object summaries must not be rendered as the visible stat presentation.

Phone detail views should make verified data feel present even when optional profile fields are unavailable. Use compact verified-data summaries, collapsed source-missing notes, short stat tables, and fixed-bottom-nav clearance rather than long stacks of visible `N/A` rows.

Literal source values such as `N/A`, `Limited data`, `Insufficient verified data`, `source_missing`, or `not_applicable` must not be counted as verified traits, abilities, ratings, or stats. When a player or recruit has verified identity/ratings but no verified trait, ability, or profile-detail record, the UI should show a compact source-status note instead of a long visible list of `N/A` rows.

Recruiting board records and recruiting class/scouting records are separate sources. If a board-only recruit has no linked class/scouting detail record, the UI must label the state as `Needs verified detail link`; it must not imply that the recruit was fully checked and every profile field is legitimately missing. When a linked verified class/scouting record exists, the recruit detail card should surface national rank, position rank, state/hometown, height, weight, archetype, scouting percentage, attributes, abilities, mentals, development trait, and gem status exactly as provided.

Stats views should render verified category tables first and group unavailable categories into compact source-status notes. Large empty stat cards containing only `N/A` are not allowed when the category is absent from the verified source.

More > Analytics must be a functional in-page workspace. Analytics panels may summarize only existing verified roster, stat, opponent, and recruiting data; they must not create new football facts or inferred ratings.

## D. UI Standards

The base theme is Rutgers scarlet, black, and white, with opponent accent treatment used only as supporting context. The top header is sticky and compacts after scroll. Bottom navigation is fixed and must remain visible.

The app must be protected at 390 x 844 and 430 x 932 phone viewports. The approved Phase 1.2 matchup card behavior is the reference component and must not be redesigned casually.

## E. JSON Standards

All authoritative packages use stable IDs, explicit `package_type`, `schema_version`, and source binding metadata. Use `null` for unavailable source data when a field is intentionally present but unverified.

No inferred or fabricated values are allowed. Media and registry files must bind to existing IDs and must not duplicate ratings. Validation must parse all JSON packages, verify required IDs, and fail loudly when a required source reference cannot resolve.

## F. Weekly Opponent Workflow

The current and future weekly flow is:

1. Opponent roster.
2. Opponent media.
3. Opponent last-game stats.
4. Opponent season stats.
5. Matchup package.
6. Weekly gameplan package.
7. Validation.
8. Static publish.

Purdue is the current weekly package, not a permanent app assumption.

## G. Player Lifecycle

Cards follow `player_id`. Position slots follow roster/depth-chart state. Departed players are archived rather than overwritten. New players receive new IDs and cards. No player permanently owns a position.

## H. Program Lifecycle

The coach career is permanent. The current program is dynamic. Rutgers is the active program today. Program switching is not implemented in Sprint 2 Pack A or Pack B.

## I. Playbook Standards

The app currently imports 192 verified visible Oregon formation/play combinations. Hidden off-screen plays are not claimed complete. Missing play art uses placeholders without dropping verified plays. Play IDs must remain stable. The app must not make unsupported completeness claims.

## I.1 Locked Card And Run Logic Standards

Player Cards are locked to `player_id`. Season Stats must render before Last Game. The default expanded Player Card shows the top six position-relevant attributes, with remaining attributes under More Detail.

Play Cards must preserve all 192 verified visible play combinations and render play art through the existing placeholder fallback when art is missing. Run Play Cards resolve run style through one resolver layer, then resolve recommended ball carrier by stable `player_id` from weekly coaching-decision JSON. Player names must not be hardcoded in the renderer.

Run-lane recommendations may display a best side only when weekly run-lane analysis contains verified lane scoring. Limited-data lanes must remain limited and must not be promoted into fabricated left/right recommendations.

## I.2 Gameplan Intelligence Standards

The Gameplan tab is a Rutgers home-team dashboard, not a coordinator report wall or statistics page. It is organized around the current Rutgers snapshot, key offensive players, offensive depth chart, roster overview, and quick navigation into the deeper workspaces.

Weekly coordinator recommendations and comparison rows remain available to supporting workspaces through `data/weekly/weekly_matchup_summary.json`. The UI must not fabricate missing comparison values, pressure calls, coverage calls, lane scores, player grades, or play grades.

Unsupported defensive or offensive metrics remain `null` in JSON and render as `Limited data`. Top Three references resolve by stable play IDs through the locked Play Card system.

## I.3 Permanent Tab Responsibility Standard

Gameplan owns the compact Rutgers home snapshot, key offensive players, offensive depth chart, roster overview, and quick-action routing into Top Plays, Personnel, and Recruiting.

Top Plays owns Random Top 3 generation, the Top 3 selector, all 192 verified visible play combinations, play art, play filters, play search, favorites, run/pass/RPO/play-action/screen groupings, and expanded Play Cards. The default Top Plays action must not claim more than the 192 verified plays currently present in the source inventory.

Personnel owns matchup-first weekly roster comparisons, weekly team roster, weekly opponent roster, player cards, depth chart, O-line, generated roster-vs-roster matchup comparisons, verified player matchup details, defined opponent scouting sections, and compact Rutgers/opponent stat dashboards.

Personnel roster browsing uses Home Team and Away Team roster hubs. Each hub should provide a team header, Players/Team controls, a team-leader strip, position filters, a horizontal-safe roster table, and compact player cards for detail navigation. Roster table columns must be position-aware and show verified player attributes instead of a fixed generic pair. Matchups should prioritize the top verified player matchup first, then the next two position/roster matchup cards, with remaining matchups in a drill-down list.

Recruiting owns the recruiting board, every prospect card, scheme fit, recruiting value, projected role, player-specific recruiting intelligence, deterministic Team Needs-driven Top 3 recommendations, and recruit detail tab content. Team Needs may use verified senior departures and explicit position-change fields, but must not infer position changes.

Gameplan must not own the full play library, play filters, play search, Top 3 selector, repeated full play cards, run-game cards, passing-game cards, offensive/defensive gameplan cards, pressure cards, coverage cards, or Rutgers-vs-opponent raw comparison sections.

## I.4 Sports-App Card Interaction Standard

Rutgers players, weekly opponent players, and recruits use compact list-first cards. Compact cards must use one shared sports-app structure: portrait or avatar on the left, identity and verified role data in the center, one fit/threat/priority badge on the right, and a bottom strip of 4-6 verified metrics.

Full player and recruit information belongs on dedicated detail screens, not giant inline expanded cards. Detail screens must provide a hero, tab strip, separated stats sections, and a back action that returns to the prior list with filter and scroll context preserved where practical.

Recruit stars, recruit gem status, and player development traits are rendered only when present in connected video-verified or authoritative JSON. Absence renders `N/A` or no badge; the UI must not infer stars, gems, or development traits from rank, position, or roster role.

## J. Validation Standards

Required checks include roster count, media coverage, registry coverage, portrait existence, required position coverage, matchup ID resolution, play count, play ID uniqueness, no raw object coercion, mobile overflow safeguards, and GitHub Pages static compatibility.

## J.1 Identity Linkage Standard

Every rendered card and recommendation must resolve through a canonical stable ID. Rutgers players use existing valid `player_id` values from `data/rutgers_roster_base.json`; missing future Rutgers IDs are generated as `rut-{position}-{normalized-name}`. Opponent players preserve existing valid IDs from weekly opponent/player/stat packages; missing future opponent IDs are generated as `{team-abbreviation}-{position}-{normalized-name}`. Recruiting prospects preserve existing valid `prospect_id` values; missing future prospect IDs are generated as `rec-{position}-{normalized-name}` with a numeric disambiguator only when needed. Verified play combinations preserve existing static play IDs; missing future play IDs are generated as `play-{formation-family}-{set-or-subformation}-{play-name}`.

Normalization is lowercase, hyphen-separated, punctuation-free, stable across weekly imports, and never random UUID-based. Identity registries live at `data/base/player_identity_registry.json`, `data/base/prospect_identity_registry.json`, and `data/base/play_identity_registry.json`; the audit migration map lives at `data/migrations/identity_id_map.json`.

Identity registries may reference source files and IDs only. They must not duplicate ratings, attributes, stats, grades, recruiting evaluations, play scores, or matchup claims. Missing source data remains `N/A` or `Limited data`; unresolved identity references are hard validation failures.

## J.2 Identity Join State Standard

A canonical ID is not successfully linked merely because it exists. Successful joins must resolve the exact identity record, exact source detail record, exact attribute/stat/media/depth record when applicable, and then render the correct card.

Join states are explicit:

- `verified`: exact source data resolved and may render the real value.
- `source_missing`: the source package is valid but the field or detail row is genuinely absent; render `N/A`, hide the field, or document the limitation.
- `join_failed`: a required canonical foreign key or detail record did not resolve; validation must fail and the UI must not mask it as normal missing data.
- `not_applicable`: the field does not apply to the card or context; render `N/A` or hide the field.

Recruiting joins resolve by `prospect_id` first, then explicit migration mapping, then exact normalized full name plus position, then exact normalized full name plus state plus position. Recruit joins must not use array index, board order, surname only, display text only, or position alone.

Recruit board rank must render only from the authoritative explicit rank field. If the rank source is absent, render `N/A`; never derive display rank from array position.

Rutgers depth-chart slots resolve by explicit `player_id` first, then migration mapping, then exact normalized full name plus exact position. Generic `T`, `G`, or `OL` positions must not be guessed into left or right slots without an explicit slot source.

## J.3 Video Evidence And Production ID Standard

Video-derived data must be indexed in `data/audit/video_evidence_index.json` when it is recovered into authoritative JSON. The evidence index records every current Rutgers player, opponent player, recruit, verified visible play, and matchup, with source video/frame metadata and verified/source-missing field lists.

Timestamps must never be invented. If the active source package contains only extracted frames or source-video filenames without timestamp metadata, the timestamp field remains `null` and the limitation is documented in the audit reports.

Canonical IDs remain internal implementation details. Production card text must not show `player_id`, `prospect_id`, `play_id`, or `matchup_id`; visible cards must use player names, play names, matchup labels, or human-readable summaries instead.

Uniform card contracts are required. Player detail cards use the same Overview, Attributes, Stats, Matchups, and Plays sections. Recruit detail cards use the same Overview, Scouting, Fit, and Activity sections.

## J.4 Video-Only Source Layer

When a `data/video_verified/` package is present, it is the active source layer for the fields it covers. The video-only source layer is generated only from the five CFB27 video-only package videos and must keep unshown or unreadable values as `N/A`.

The static GitHub Pages app loads video-only bundles before `app.js`. App data loaders prefer video-only Rutgers season stats, Purdue season stats, Purdue roster, four-star freshman class, and Rutgers prospect board data when those bundles are present.

Video-only records must include a source video, timestamp/frame evidence, verified fields, and `N/A` fields. Internal IDs remain hidden from production UI and may appear only in audit JSON or developer reports.

## J.5 Production Binding And Sports-App Interaction

Production recruiting screens resolve through a display model that prefers the video-verified Rutgers prospect board and four-star freshman class packages. If a video-verified value exists for the same canonical recruit identity, the production card or detail screen must use it instead of stale resolver output.

Opponent roster screens render the full active weekly opponent roster from the video-verified opponent roster package when present. Purdue is the current package, but the behavior is weekly-package driven.

Top Plays uses one production ranking object for Best Play and Top 3. Top 3 must contain three unique verified play IDs when at least three eligible verified plays exist.

Roster, opponent, and recruiting lists follow the sports-app pattern: compact card, tap, dedicated detail screen, back. Default list screens must not render giant inline detail pages.

Production UI must translate raw internal status values such as `active_target`, `source_missing`, `verified_matchup_data`, and `limited_lane_scoring` into readable labels or `N/A`.

## K. Release Workflow

The release workflow is: implement, self-validate, generate reports, phone test, freeze approved component, and use the tagged/frozen baseline for the next pack. Cross-sprint scope leakage is not allowed.

## L. Documentation Index

Detailed permanent standards now live under `/docs`:

- `docs/DESIGN_SYSTEM.md` defines the Design System Governance Standard, including DS-001 through DS-009, DS-013, and DS-014.
- `docs/JSON_STANDARD.md` defines DS-010 JSON ownership and package source-of-truth rules.
- `docs/UI_COMPONENT_STANDARD.md` defines DS-011 reusable intelligence and shared component rules.
- `docs/VALIDATION_STANDARD.md` defines DS-012 visual regression and validation policy.
- `docs/RELEASE_STANDARD.md` defines release, report, and deployment workflow.

Future implementation prompts should begin by reading this `PROJECT_SPEC.md` index and then the linked standard documents relevant to the requested scope.

## Permanent Video Source-Of-Truth Engine
`input_videos/` is the permanent source-of-truth intake folder for weekly CFB27 videos and future adapters. The ingestion layer must inventory every unique detected screen before extraction, preserve field-level evidence for every extracted value, and route uncertain values to manual review instead of guessing. Legacy JSON may be used for comparison and conflict reporting only; video-backed values win when confidently extracted.

The 192-play Oregon play inventory remains a legacy comparison baseline. Active video-verified plays must be separated from legacy-unverified, manual-review, and conflicted plays. A legacy play must never be marked video-backed unless source video evidence verifies both formation and play name.

## Roster + Stats Hybrid Review Extraction
Roster and season-stat videos use a hybrid review flow. The pipeline may create OCR-ready crops and draft values, but no roster/stat value becomes video-backed unless it carries field-level evidence and is either confirmed by review or supported by OCR confidence. Unknown values stay `null` in generated JSON and render as `N/A` in the app.

## Video OCR And Review Import

`input_videos/` remains the permanent source-of-truth intake folder. OCR output is treated as a draft only. Generated roster/stat values become video-backed data only when the review JSON/CSV row is marked `confirmed` and includes field-level crop evidence.

### Structured OCR Drafts

The video source-of-truth pipeline may parse OCR crop text into structured candidate rows, but those rows are not authoritative until a reviewer marks fields `confirmed`. Raw OCR remains evidence, not source-truth data.

### Roster Sweep Source Truth

Roster videos use a full-duration sweep path for player-card extraction. The sweep scans at a 4 fps baseline, adds burst frames around detected roster/card/table changes, and records unique roster screens plus side-card appearances. The highlighted roster table row is the primary source for player identity. Side-card OCR may enrich the roster-owned player record with visible profile fields, traits, and attributes, but it must not create a new player identity. Unreadable table identities and fields remain manual-review evidence instead of guesses.

## Dynasty Hub Source Of Truth

The long-term source of truth is the local CFB27 dynasty save file. The local runtime decodes `FBCHUNKS`, decompresses the zlib payload, and writes save-backed generated JSON under `data/generated/dynasty/`. Videos and legacy JSON are comparison-only and must not override save-backed values.

## K. Dynasty Save Reader Standards

The local CFB27 dynasty save reader is the long-term source-of-truth path for full Dynasty Hub data. Raw save files remain local and must not be committed. Generated save-backed JSON belongs under `data/generated/dynasty/` and every promoted value must carry save evidence, including source save path/hash, decompressed hash, decompressed offset, table or record name, confidence, and decode status.

The current save reader confirms the `FBCHUNKS` container and Rutgers team identity, and it emits player-schema outputs through `python process_week.py --extract dynasty_players`. Player rows, player stats, and depth-chart references remain blocked decoder gaps until the binary Player table row boundaries, stable player references, and stat/depth foreign keys are proven. Candidate comparison bytes, including QB depth-chart reference swaps, are analysis-only and must not be treated as verified roster, rating, attribute, stat, or depth-chart data.

The app must never fill save-reader gaps with legacy JSON, video OCR, or guessed football values. Legacy/manual/video data may be compared against save output, but save-backed generated packages may promote only values decoded from the save with field-level evidence. Ratings and attributes decoded from the save must remain inside valid game ranges before promotion.

## L. Read-Only Authorized Parser Layer

`tools/cfb27_save_reader/` is the guarded read-only wrapper for authorized CFB27 save parser research. It must discover the save, copy it to a timestamped snapshot, verify source and copied SHA-256 hashes match, and run parser operations only against the copied file.

The intended parser is the pinned local build of `leaguelines/cfb-dynasty`. Parser binaries and schema bundles, including any locally installed `madden-franchise` CFB27 schema reference, must stay out of Git. The reader records parser repository, pinned commit, executable hash, schema filename, and schema hash when configured.

Normalized data produced by this layer uses `data/dynasty/normalized/dynasty_normalized.schema.json`. Every promoted field must use a provenanced value object with source, confidence, parser version, and raw reference. Parser output is `probable` until the Rutgers stable team ID and several visible game values are cross-checked across saved weeks. Comparison experiments remain experimental and must not promote roster, stats, recruiting, schedule, or depth-chart data.
