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

The Gameplan tab is a coordinator dashboard, not a statistics page. It is organized into Offensive Gameplan and Defensive Gameplan sections.

Weekly coordinator recommendations and comparison rows are resolved through `data/weekly/weekly_matchup_summary.json`. The UI renders that intelligence layer and must not fabricate missing comparison values, pressure calls, coverage calls, lane scores, player grades, or play grades.

Unsupported defensive or offensive metrics remain `null` in JSON and render as `Limited data`. Best Play and Top Three references resolve by stable play IDs through the locked Play Card system.

## J. Validation Standards

Required checks include roster count, media coverage, registry coverage, portrait existence, required position coverage, matchup ID resolution, play count, play ID uniqueness, no raw object coercion, mobile overflow safeguards, and GitHub Pages static compatibility.

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
