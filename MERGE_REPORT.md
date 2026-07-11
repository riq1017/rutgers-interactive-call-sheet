# MERGE_REPORT

## Sources Used

- Primary baseline: `Rutgers_Interactive_Call_Sheet_Purdue_v1_PLAY_ART_INTEGRATED.zip`
- Recruiting, roster, and team-needs data: `Rutgers_Codex_Recruiting_Roster_TeamNeeds.zip`
- UI direction: approved Gameday Gameplan image
- Existing repository: retained as the active working repository and final commit target

## Merge Decisions

- Preserved the statistical recommendation engine and recent-call/setup logic from the existing Rutgers build.
- Imported the play-art playbook mappings and all SVG assets from the play-art integrated build.
- Added the structured recruiting JSON files without converting null values into zeros.
- Added `data/recruiting_data.js` as a static browser loader so the app works from an extracted folder and from GitHub Pages.
- Replaced the bottom navigation with Gameplan, Top Plays, Personnel, Recruiting, and More.
- Kept opponent/gameplan data separate from recruiting, roster, and team-needs data.

## Conflicts And Resolutions

- Bottom navigation conflict: the previous Scouting tab was moved into More and duplicated into the Gameplan screen so Recruiting could become a permanent first-class tab.
- Play diagram conflict: the placeholder diagram card was replaced by protected SVG image loading with `formation-fallback.svg` on error.
- Data availability conflict: unavailable recruiting, roster, and performance values remain `null` in JSON and render as `Unknown` in the Recruiting UI.

## Result

Overall merge status: PASS.
