# PLAYER_DETAIL_BEHAVIOR_REPORT

Status: PASS

Player and recruit list behavior now follows the sports-app pattern:

`compact card -> tap -> dedicated detail screen -> back`

Implemented:

- Rutgers roster list uses compact player rows
- Purdue roster list uses compact opponent rows
- Recruit list uses compact recruit rows
- Rutgers player detail preserves the existing premium Player Card engine inside a dedicated screen
- Purdue detail sections: Overview, Attributes, Stats, Matchups
- Recruit detail sections: Overview, Scouting, Fit, Activity

Default roster and recruiting lists no longer render giant inline detail pages.
