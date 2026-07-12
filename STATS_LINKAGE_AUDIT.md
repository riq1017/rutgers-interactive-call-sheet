# Stats Linkage Audit

## Result
- Stats linkage audit: PASS
- Rutgers Last Game bindings: 6
- Rutgers Season bindings: 18
- Opponent Last Game bindings: 11
- Opponent Season bindings: 12
- Unresolved stat references: 0

## Rules Enforced
- Rutgers stats resolve by `player_id` and matching name.
- Opponent stats resolve by canonical opponent player ID and matching name.
- Last Game and Season stats remain separate scopes.
- Stat-only Purdue player IDs are preserved in the player identity registry without inventing roster cards, portraits, ratings, or attributes.
- Missing production remains `Limited data` and does not remove player cards.
