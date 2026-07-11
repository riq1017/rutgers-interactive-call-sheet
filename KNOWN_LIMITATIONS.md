# KNOWN_LIMITATIONS

- Play-art SVGs are concept-matched schematics from the supplied package, not verified exact in-game route art.
- Recruiting priority scoring uses neutral values for missing performance, signing, pipeline, interest, cost, and competition metrics.
- Roster-driven recruiting priority is limited by the small verified roster subset in `data/roster.json`.
- Static JSON import/export works in-browser, but raw JSON files do not auto-fetch from disk; `data/recruiting_data.js` is the static loader for file and GitHub Pages compatibility.
- Recruiting filters cover the available verified/null-safe fields; unavailable fields render as `Unknown`.
