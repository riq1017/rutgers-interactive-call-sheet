# Full Video Entity Extraction Report

Scope: Rutgers roster/player cards, Purdue weekly roster, Rutgers season stats, Purdue season stats, Rutgers prospect board, and four-star freshman class evidence.

Implemented recovery bundles:
- `data/video_verified/rutgers_roster_recovery.js`
- `data/video_verified/purdue_roster_recovery.js`
- `data/video_verified/rutgers_board_scouting_recovery.js`

Recovered verified examples:
- Rutgers: M. York, R. Bieniemy, T. Simonson, G. Oluwatimi, S. Degraffenreidt, S. Moore, J. Elijah, J. Felton, D. Sturgis, C. Lantz, R. Callow, W. Nwaneri.
- Purdue: Y. Hernandez, K. Webb, J. Lewis, Q. Gillians, R. Daniels, D. Lincoln, P. Jerry, J. Austin, K. Heneghan, D. Snead, D. Parker.
- Recruiting board detail screens: E. Isaac, N. Scheffler, B. Ahlers, T. Abreu, S. Coco, M. Whitted, P. Ejiofor.

Rules applied:
- Verified values render from stable IDs only.
- Blurry visible fields are marked `needs_review`.
- Not-visible fields remain `N/A` and are reported as source-missing.
- Purdue remains the current weekly opponent package.

Status: PASS for implemented verified overlays; remaining full-video transcription work is documented where evidence was not readable in this pass.
