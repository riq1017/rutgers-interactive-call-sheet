# ROSTER_BASE_IMPORT_REPORT

Source package: `Rutgers_Recruiting_Engine_5_Video_Seed.zip`

## Imported
- `data/depth_chart_seed.json`
- `data/recruiting_engine_seed.json`
- `data/coach_abilities_seed.json`
- `data/integration_contract.json`
- `data/video_manifest.json`
- Contact-sheet references copied under `reference/engine5_seed/`

## Shared Roster Base
Created `data/rutgers_roster_base.json` from the existing corrected Rutgers video-derived roster and the seed package depth-chart structure.

## Verified Roster Values
The roster base includes only the verified player rows already present in the corrected structured roster package: M. York, R. Bieniemy, S. Warner, and J. Portillo.

## Unresolved Values
`depth_chart_seed.json` marks the full roster/depth chart as `manual_transcription_required` and contains empty player arrays. No additional players, depth-chart orders, development traits, injuries, expected departures, or attributes were invented.

## Null Preservation
Depth order, development trait, injury status, expected departure, scheme role, non-visible attributes, season stats, and last-game stats remain null or empty unless already verified in the corrected data source.
