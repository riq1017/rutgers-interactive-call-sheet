# KNOWN_LIMITATIONS

- `depth_chart_seed.json` marks the full Rutgers roster/depth chart as manual transcription required, so non-verified roster rows are not added.
- Depth-chart order, injuries, expected departures, development traits, coach-ability tiers, and most prospect fields remain null unless verified in source data.
- Headless Edge produced the required 390x844 screenshots. Edge logged background sync network aborts because network access is restricted, but the local static app loaded and screenshots were written.
- Weekly Gameplan matchup modifiers remain neutral when an imported package omits matchup matrix data.
- Verified per-lane rushing attempts/yards, per-gap pressure counts, detailed O-line stat grids, full last-game stat grids, and full season stat grids are not present in the current package; the UI hides those missing metrics rather than fabricating them.
