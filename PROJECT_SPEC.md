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
