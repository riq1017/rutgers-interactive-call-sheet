# Identity Foundation Report

## Result
- Overall identity foundation status: PASS
- Unresolved identity references: 0
- No football ratings, attributes, stats, matchup grades, play scores, or recruiting evaluations were duplicated into identity registries.

## Canonical ID Rules
- Rutgers players: preserve existing valid `player_id`; otherwise `rut-{position}-{normalized-name}`.
- Opponent players: preserve existing valid opponent player ID; otherwise `{team-abbreviation}-{position}-{normalized-name}`.
- Recruiting prospects: preserve existing valid `prospect_id`; otherwise `rec-{position}-{normalized-name}` with numeric disambiguator only for collisions.
- Plays: preserve existing verified static play ID; otherwise `play-{formation-family}-{set-or-subformation}-{play-name}`.
- Normalization: lowercase, hyphen-separated, punctuation removed, stable, no random UUIDs.

## Canonical Registries
- `data/base/player_identity_registry.json`
- `data/base/prospect_identity_registry.json`
- `data/base/play_identity_registry.json`
- `data/migrations/identity_id_map.json`

## Required Counts
| Item | Count |
| --- | ---: |
| Rutgers roster records | 48 |
| Rutgers canonical player IDs | 48 |
| Rutgers base Player Cards | 48 |
| Rutgers media bindings | 48 |
| Rutgers Last Game bindings | 6 |
| Rutgers Season bindings | 18 |
| Rutgers development-trait bindings | 0 |
| Opponent player records | 26 |
| Opponent canonical player IDs | 26 |
| Opponent media bindings | 16 |
| Recruit names | 61 |
| Recruit canonical IDs | 61 |
| RecruitCards | 61 |
| Recruit attribute objects | 61 |
| Verified gems | 0 |
| Plays in verified playbook | 192 |
| Canonical play IDs | 192 |
| Play-art bindings | 192 |
| Placeholder-art bindings | 192 |
| Top Play references | 1 |
| Top 3 references | 3 |
| Recommended player references | 9 |
| Matchup references | 7 |
| Unresolved references | 0 |

## Notes
- The current Purdue card package has 16 opponent card players and 16 media bindings.
- Opponent stat files include 10 additional stat-only Purdue player IDs. They are included in the player identity registry with null media/card refs so stat references resolve without inventing portraits or ratings.
