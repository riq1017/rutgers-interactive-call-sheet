# KNOWN_LIMITATIONS

- `depth_chart_seed.json` marks the full Rutgers roster/depth chart as manual transcription required, so non-verified roster rows are not added.
- Depth-chart order, injuries, expected departures, development traits, coach-ability tiers, and most prospect fields remain null unless verified in source data.
- The live browser smoke was blocked by local URL policy in the in-app browser; static mobile checks and clean ZIP validation passed.
- Weekly Gameplan matchup modifiers remain neutral when an imported package omits run direction, protection, or matchup matrix data.
