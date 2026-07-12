# JSON_STANDARD

## Ownership

DS-010 JSON Ownership: verified football data belongs in JSON. Rendering files may bind to IDs, format fields, and choose layout, but must not invent or duplicate ratings, matchup results, scouting facts, play recommendations, recruiting facts, or player identities.

## Package Rules

Authoritative packages use stable IDs, `package_type`, `schema_version`, and source-binding metadata where applicable.

Unavailable source data remains `null` in JSON and renders as `Limited data` or is hidden by the UI.

Rutgers weekly data, opponent weekly data, playbook data, recruiting data, and game history remain separate so weekly packages can be replaced independently.
