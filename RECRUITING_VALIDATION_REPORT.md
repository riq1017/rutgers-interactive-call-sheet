# Recruiting Validation Report

- PASS - Recruiting overview uses real values from `recruiting_weekly.json`: scholarships, weekly hours, board size, and target limit.
- PASS - Priority logic is ordered by on-field progress, roster depth, future depth, scheme fit, target deficit, and feasibility.
- PASS - Position filters include every position present in `recruiting_class.json`.
- PASS - Prospect cards render names, positions, ranks, archetypes, hometown, dealbreaker, scouting summaries, strengths, questions, scheme fit, recruiting value, and recommended action from `prospect.analysis`.
- PASS - Null fields are hidden.
- PASS - Weekly action plan uses active-board records and fixes broken name/action concatenation.
- PASS - No fake faces, fake ratings, or mockup prospect names are copied.
