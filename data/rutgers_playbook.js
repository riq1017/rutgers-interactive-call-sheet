window.RUTGERS_PLAYBOOK = [
  {
    "id": "power-o",
    "name": "Power O",
    "formation": "Goal Line Offense",
    "family": "run_inside",
    "baseScore": 82,
    "situations": [
      "short",
      "goal_line",
      "red_zone"
    ],
    "conceptFamily": "inside run",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 3,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "short",
    "primaryPositions": [
      "HB1"
    ],
    "secondaryPositions": [
      "TE1"
    ],
    "requiredAttributes": [
      "vision",
      "carrying",
      "breakTackle"
    ],
    "riskLevel": "low",
    "objective": "red-zone score"
  },
  {
    "id": "pa-power-o",
    "name": "PA Power O",
    "formation": "Goal Line Offense",
    "family": "play_action",
    "baseScore": 76,
    "situations": [
      "goal_line",
      "red_zone"
    ],
    "conceptFamily": "play action",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "QB1",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "HB1"
    ],
    "requiredAttributes": [
      "playAction",
      "throwOnRun",
      "awareness",
      "throwUnderPressure"
    ],
    "riskLevel": "medium",
    "objective": "red-zone score"
  },
  {
    "id": "hb-sting",
    "name": "HB Sting",
    "formation": "Goal Line Offense",
    "family": "run_inside",
    "baseScore": 81,
    "situations": [
      "short",
      "goal_line"
    ],
    "conceptFamily": "inside run",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 3,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "short",
    "primaryPositions": [
      "HB1"
    ],
    "secondaryPositions": [
      "TE1"
    ],
    "requiredAttributes": [
      "vision",
      "carrying",
      "breakTackle"
    ],
    "riskLevel": "low",
    "objective": "red-zone score"
  },
  {
    "id": "hb-dive",
    "name": "HB Dive",
    "formation": "Goal Line Offense",
    "family": "run_inside",
    "baseScore": 84,
    "situations": [
      "short",
      "goal_line",
      "red_zone"
    ],
    "conceptFamily": "inside run",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 3,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "short",
    "primaryPositions": [
      "HB1"
    ],
    "secondaryPositions": [
      "TE1"
    ],
    "requiredAttributes": [
      "vision",
      "carrying",
      "breakTackle"
    ],
    "riskLevel": "low",
    "objective": "red-zone score"
  },
  {
    "id": "y-stick",
    "name": "Y Stick",
    "formation": "Pistol",
    "family": "quick",
    "baseScore": 80,
    "situations": [
      "medium",
      "red_zone",
      "two_minute"
    ],
    "conceptFamily": "quick pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "WR2",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "catching",
      "routeRunning",
      "awareness"
    ],
    "riskLevel": "low",
    "objective": "red-zone score"
  },
  {
    "id": "read-option-wk",
    "name": "Read Option WK",
    "formation": "Pistol",
    "family": "option",
    "baseScore": 78,
    "situations": [
      "short",
      "medium"
    ],
    "conceptFamily": "option",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "QB1",
      "HB1"
    ],
    "secondaryPositions": [
      "HB2"
    ],
    "requiredAttributes": [
      "speed",
      "awareness",
      "carrying"
    ],
    "riskLevel": "medium",
    "objective": "move chains"
  },
  {
    "id": "posts",
    "name": "Posts",
    "formation": "Pistol",
    "family": "deep",
    "baseScore": 73,
    "situations": [
      "long",
      "must_score"
    ],
    "conceptFamily": "deep pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 7,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "WR1",
      "WR2"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "speed",
      "acceleration",
      "release",
      "deepRouteRunning",
      "catching"
    ],
    "riskLevel": "high",
    "objective": "explosive opportunity"
  },
  {
    "id": "pa-deep-out",
    "name": "PA Deep Out",
    "formation": "Pistol",
    "family": "play_action",
    "baseScore": 76,
    "situations": [
      "medium",
      "long"
    ],
    "conceptFamily": "play action",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "QB1",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "HB1"
    ],
    "requiredAttributes": [
      "playAction",
      "throwOnRun",
      "awareness",
      "throwUnderPressure"
    ],
    "riskLevel": "medium",
    "objective": "move chains"
  },
  {
    "id": "inside-zone-split",
    "name": "Inside Zone Split",
    "formation": "Pistol",
    "family": "run_inside",
    "baseScore": 86,
    "situations": [
      "short",
      "medium",
      "normal"
    ],
    "conceptFamily": "inside run",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 5,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "HB1"
    ],
    "secondaryPositions": [
      "TE1"
    ],
    "requiredAttributes": [
      "vision",
      "carrying",
      "breakTackle"
    ],
    "riskLevel": "low",
    "objective": "clock control"
  },
  {
    "id": "four-verticals",
    "name": "Four Verticals",
    "formation": "Pistol",
    "family": "deep",
    "baseScore": 69,
    "situations": [
      "long",
      "must_score"
    ],
    "conceptFamily": "deep pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 7,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "WR1",
      "WR2"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "speed",
      "acceleration",
      "release",
      "deepRouteRunning",
      "catching"
    ],
    "riskLevel": "high",
    "objective": "explosive opportunity"
  },
  {
    "id": "pa-boot-slide",
    "name": "PA Boot Slide",
    "formation": "Pistol",
    "family": "play_action",
    "baseScore": 83,
    "situations": [
      "medium",
      "red_zone"
    ],
    "conceptFamily": "play action",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "QB1",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "HB1"
    ],
    "requiredAttributes": [
      "playAction",
      "throwOnRun",
      "awareness",
      "throwUnderPressure"
    ],
    "riskLevel": "medium",
    "objective": "red-zone score"
  },
  {
    "id": "inside-zone-wk",
    "name": "Inside Zone WK",
    "formation": "Pistol",
    "family": "run_inside",
    "baseScore": 84,
    "situations": [
      "short",
      "medium",
      "normal"
    ],
    "conceptFamily": "inside run",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 5,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "HB1"
    ],
    "secondaryPositions": [
      "TE1"
    ],
    "requiredAttributes": [
      "vision",
      "carrying",
      "breakTackle"
    ],
    "riskLevel": "low",
    "objective": "clock control"
  },
  {
    "id": "read-option",
    "name": "Read Option",
    "formation": "Pistol",
    "family": "option",
    "baseScore": 79,
    "situations": [
      "short",
      "medium"
    ],
    "conceptFamily": "option",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "QB1",
      "HB1"
    ],
    "secondaryPositions": [
      "HB2"
    ],
    "requiredAttributes": [
      "speed",
      "awareness",
      "carrying"
    ],
    "riskLevel": "medium",
    "objective": "move chains"
  },
  {
    "id": "counter",
    "name": "Counter",
    "formation": "Pistol",
    "family": "run_inside",
    "baseScore": 82,
    "situations": [
      "short",
      "medium"
    ],
    "conceptFamily": "inside run",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 5,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "HB1"
    ],
    "secondaryPositions": [
      "TE1"
    ],
    "requiredAttributes": [
      "vision",
      "carrying",
      "breakTackle"
    ],
    "riskLevel": "low",
    "objective": "clock control"
  },
  {
    "id": "pa-te-waggle",
    "name": "PA TE Waggle",
    "formation": "Pistol",
    "family": "play_action",
    "baseScore": 82,
    "situations": [
      "medium",
      "red_zone"
    ],
    "conceptFamily": "play action",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "QB1",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "HB1"
    ],
    "requiredAttributes": [
      "playAction",
      "throwOnRun",
      "awareness",
      "throwUnderPressure"
    ],
    "riskLevel": "medium",
    "objective": "red-zone score"
  },
  {
    "id": "pa-te-corner",
    "name": "PA TE Corner",
    "formation": "Goal Line Offense",
    "family": "play_action",
    "baseScore": 79,
    "situations": [
      "red_zone",
      "goal_line"
    ],
    "conceptFamily": "play action",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "QB1",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "HB1"
    ],
    "requiredAttributes": [
      "playAction",
      "throwOnRun",
      "awareness",
      "throwUnderPressure"
    ],
    "riskLevel": "medium",
    "objective": "red-zone score"
  },
  {
    "id": "pa-crossers",
    "name": "PA Crossers",
    "formation": "Goal Line Offense",
    "family": "play_action",
    "baseScore": 78,
    "situations": [
      "medium",
      "red_zone"
    ],
    "conceptFamily": "play action",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "QB1",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "HB1"
    ],
    "requiredAttributes": [
      "playAction",
      "throwOnRun",
      "awareness",
      "throwUnderPressure"
    ],
    "riskLevel": "medium",
    "objective": "red-zone score"
  },
  {
    "id": "stick",
    "name": "Stick",
    "formation": "Pistol",
    "family": "quick",
    "baseScore": 80,
    "situations": [
      "medium",
      "two_minute"
    ],
    "conceptFamily": "quick pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "WR2",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "catching",
      "routeRunning",
      "awareness"
    ],
    "riskLevel": "low",
    "objective": "move chains"
  },
  {
    "id": "mesh",
    "name": "Mesh",
    "formation": "Pistol",
    "family": "quick",
    "baseScore": 84,
    "situations": [
      "medium",
      "long",
      "two_minute"
    ],
    "conceptFamily": "quick pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "WR2",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "catching",
      "routeRunning",
      "awareness"
    ],
    "riskLevel": "low",
    "objective": "move chains"
  },
  {
    "id": "pa-stretch-shot",
    "name": "PA Stretch Shot",
    "formation": "Pistol",
    "family": "deep",
    "baseScore": 72,
    "situations": [
      "long",
      "must_score"
    ],
    "conceptFamily": "deep pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 7,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "WR1",
      "WR2"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "speed",
      "acceleration",
      "release",
      "deepRouteRunning",
      "catching"
    ],
    "riskLevel": "high",
    "objective": "explosive opportunity"
  },
  {
    "id": "jet-slam-alert-smoke",
    "name": "Jet Slam Alert Smoke",
    "formation": "Pistol",
    "family": "rpo",
    "baseScore": 82,
    "situations": [
      "short",
      "medium",
      "normal"
    ],
    "conceptFamily": "RPO",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "QB1",
      "HB1"
    ],
    "secondaryPositions": [
      "WR1",
      "TE1"
    ],
    "requiredAttributes": [
      "awareness",
      "shortAccuracy",
      "throwOnRun"
    ],
    "riskLevel": "low",
    "objective": "pressure answer"
  },
  {
    "id": "pa-x-burst",
    "name": "PA X Burst",
    "formation": "Pistol",
    "family": "play_action",
    "baseScore": 78,
    "situations": [
      "medium",
      "long"
    ],
    "conceptFamily": "play action",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "QB1",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "HB1"
    ],
    "requiredAttributes": [
      "playAction",
      "throwOnRun",
      "awareness",
      "throwUnderPressure"
    ],
    "riskLevel": "medium",
    "objective": "move chains"
  },
  {
    "id": "hb-zone-wk",
    "name": "HB Zone WK",
    "formation": "Pistol",
    "family": "run_inside",
    "baseScore": 84,
    "situations": [
      "short",
      "medium",
      "normal"
    ],
    "conceptFamily": "inside run",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 5,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "HB1"
    ],
    "secondaryPositions": [
      "TE1"
    ],
    "requiredAttributes": [
      "vision",
      "carrying",
      "breakTackle"
    ],
    "riskLevel": "low",
    "objective": "clock control"
  },
  {
    "id": "hb-dive-pistol",
    "name": "HB Dive",
    "formation": "Pistol",
    "family": "run_inside",
    "baseScore": 84,
    "situations": [
      "short",
      "goal_line"
    ],
    "conceptFamily": "inside run",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 3,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "short",
    "primaryPositions": [
      "HB1"
    ],
    "secondaryPositions": [
      "TE1"
    ],
    "requiredAttributes": [
      "vision",
      "carrying",
      "breakTackle"
    ],
    "riskLevel": "low",
    "objective": "red-zone score"
  },
  {
    "id": "four-verticals-2",
    "name": "Four Verticals",
    "formation": "Pistol Strong",
    "family": "deep",
    "baseScore": 68,
    "situations": [
      "long",
      "must_score"
    ],
    "conceptFamily": "deep pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 7,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "WR1",
      "WR2"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "speed",
      "acceleration",
      "release",
      "deepRouteRunning",
      "catching"
    ],
    "riskLevel": "high",
    "objective": "explosive opportunity"
  },
  {
    "id": "pa-boot-slide-2",
    "name": "PA Boot Slide",
    "formation": "Pistol Strong",
    "family": "play_action",
    "baseScore": 83,
    "situations": [
      "medium",
      "red_zone"
    ],
    "conceptFamily": "play action",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "QB1",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "HB1"
    ],
    "requiredAttributes": [
      "playAction",
      "throwOnRun",
      "awareness",
      "throwUnderPressure"
    ],
    "riskLevel": "medium",
    "objective": "red-zone score"
  },
  {
    "id": "pa-fl-counter-y-screen",
    "name": "PA FL Counter Y Screen",
    "formation": "Pistol",
    "family": "screen",
    "baseScore": 84,
    "situations": [
      "medium",
      "long"
    ],
    "conceptFamily": "screen",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 7,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "HB1",
      "HB2",
      "TE1"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "acceleration",
      "agility",
      "vision",
      "catching"
    ],
    "riskLevel": "low",
    "objective": "pressure answer"
  },
  {
    "id": "pa-zone-wk",
    "name": "PA Zone WK",
    "formation": "Pistol",
    "family": "play_action",
    "baseScore": 78,
    "situations": [
      "medium"
    ],
    "conceptFamily": "play action",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "QB1",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "HB1"
    ],
    "requiredAttributes": [
      "playAction",
      "throwOnRun",
      "awareness",
      "throwUnderPressure"
    ],
    "riskLevel": "medium",
    "objective": "move chains"
  },
  {
    "id": "te-attack",
    "name": "TE Attack",
    "formation": "Pistol",
    "family": "intermediate",
    "baseScore": 81,
    "situations": [
      "medium",
      "long"
    ],
    "conceptFamily": "intermediate pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 3,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "WR1",
      "TE1",
      "WR2"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "routeRunning",
      "catching",
      "awareness"
    ],
    "riskLevel": "medium",
    "objective": "move chains"
  },
  {
    "id": "pa-boot-lt",
    "name": "PA Boot LT",
    "formation": "Pistol",
    "family": "play_action",
    "baseScore": 83,
    "situations": [
      "medium",
      "red_zone"
    ],
    "conceptFamily": "play action",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "QB1",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "HB1"
    ],
    "requiredAttributes": [
      "playAction",
      "throwOnRun",
      "awareness",
      "throwUnderPressure"
    ],
    "riskLevel": "medium",
    "objective": "red-zone score"
  },
  {
    "id": "pa-rb-flat",
    "name": "PA RB Flat",
    "formation": "Pistol",
    "family": "quick",
    "baseScore": 79,
    "situations": [
      "short",
      "medium",
      "red_zone"
    ],
    "conceptFamily": "quick pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "WR2",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "catching",
      "routeRunning",
      "awareness"
    ],
    "riskLevel": "low",
    "objective": "red-zone score"
  },
  {
    "id": "pa-power-sprint-rt",
    "name": "PA Power Sprint RT",
    "formation": "Pistol",
    "family": "play_action",
    "baseScore": 78,
    "situations": [
      "short",
      "red_zone"
    ],
    "conceptFamily": "play action",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "QB1",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "HB1"
    ],
    "requiredAttributes": [
      "playAction",
      "throwOnRun",
      "awareness",
      "throwUnderPressure"
    ],
    "riskLevel": "medium",
    "objective": "red-zone score"
  },
  {
    "id": "goal-line-fade",
    "name": "Goal Line Fade",
    "formation": "Pistol",
    "family": "red_zone_pass",
    "baseScore": 75,
    "situations": [
      "goal_line"
    ],
    "conceptFamily": "intermediate pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 3,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "WR1",
      "TE1",
      "WR2"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "routeRunning",
      "catching",
      "awareness"
    ],
    "riskLevel": "medium",
    "objective": "red-zone score"
  },
  {
    "id": "pa-y-seam",
    "name": "PA Y Seam",
    "formation": "Pistol",
    "family": "intermediate",
    "baseScore": 79,
    "situations": [
      "red_zone",
      "medium"
    ],
    "conceptFamily": "intermediate pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 3,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "WR1",
      "TE1",
      "WR2"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "routeRunning",
      "catching",
      "awareness"
    ],
    "riskLevel": "medium",
    "objective": "red-zone score"
  },
  {
    "id": "rpo-read-fl-slide",
    "name": "RPO Read FL Slide",
    "formation": "Pistol",
    "family": "rpo",
    "baseScore": 84,
    "situations": [
      "short",
      "medium"
    ],
    "conceptFamily": "RPO",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "QB1",
      "HB1"
    ],
    "secondaryPositions": [
      "WR1",
      "TE1"
    ],
    "requiredAttributes": [
      "awareness",
      "shortAccuracy",
      "throwOnRun"
    ],
    "riskLevel": "low",
    "objective": "pressure answer"
  },
  {
    "id": "pa-blaze",
    "name": "PA Blaze",
    "formation": "Pistol",
    "family": "play_action",
    "baseScore": 77,
    "situations": [
      "medium",
      "long"
    ],
    "conceptFamily": "play action",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "QB1",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "HB1"
    ],
    "requiredAttributes": [
      "playAction",
      "throwOnRun",
      "awareness",
      "throwUnderPressure"
    ],
    "riskLevel": "medium",
    "objective": "move chains"
  },
  {
    "id": "fake-screen-go",
    "name": "Fake Screen Go",
    "formation": "Pistol",
    "family": "deep",
    "baseScore": 74,
    "situations": [
      "long",
      "must_score"
    ],
    "conceptFamily": "deep pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 7,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "WR1",
      "WR2"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "speed",
      "acceleration",
      "release",
      "deepRouteRunning",
      "catching"
    ],
    "riskLevel": "high",
    "objective": "explosive opportunity"
  },
  {
    "id": "mtn-slot-screen",
    "name": "MTN Slot Screen",
    "formation": "Pistol",
    "family": "screen",
    "baseScore": 82,
    "situations": [
      "medium",
      "two_minute"
    ],
    "conceptFamily": "screen",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 7,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "HB1",
      "HB2",
      "TE1"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "acceleration",
      "agility",
      "vision",
      "catching"
    ],
    "riskLevel": "low",
    "objective": "pressure answer"
  },
  {
    "id": "deep-stick",
    "name": "Deep Stick",
    "formation": "Pistol",
    "family": "intermediate",
    "baseScore": 80,
    "situations": [
      "medium",
      "long"
    ],
    "conceptFamily": "intermediate pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 3,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "WR1",
      "TE1",
      "WR2"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "routeRunning",
      "catching",
      "awareness"
    ],
    "riskLevel": "medium",
    "objective": "move chains"
  },
  {
    "id": "mtn-smash-curls",
    "name": "MTN Smash Curls",
    "formation": "Pistol",
    "family": "intermediate",
    "baseScore": 80,
    "situations": [
      "medium",
      "long"
    ],
    "conceptFamily": "intermediate pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 3,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "WR1",
      "TE1",
      "WR2"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "routeRunning",
      "catching",
      "awareness"
    ],
    "riskLevel": "medium",
    "objective": "move chains"
  },
  {
    "id": "mtn-te-middle-screen",
    "name": "MTN TE Middle Screen",
    "formation": "Pistol",
    "family": "screen",
    "baseScore": 83,
    "situations": [
      "medium",
      "long"
    ],
    "conceptFamily": "screen",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 7,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "HB1",
      "HB2",
      "TE1"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "acceleration",
      "agility",
      "vision",
      "catching"
    ],
    "riskLevel": "low",
    "objective": "pressure answer"
  },
  {
    "id": "mesh-spot",
    "name": "Mesh Spot",
    "formation": "Shotgun",
    "family": "quick",
    "baseScore": 85,
    "situations": [
      "medium",
      "long",
      "two_minute"
    ],
    "conceptFamily": "quick pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "WR2",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "catching",
      "routeRunning",
      "awareness"
    ],
    "riskLevel": "low",
    "objective": "move chains"
  },
  {
    "id": "rpo-read-zone-bubbles",
    "name": "RPO Read Zone Bubbles",
    "formation": "Shotgun",
    "family": "rpo",
    "baseScore": 86,
    "situations": [
      "short",
      "medium",
      "normal"
    ],
    "conceptFamily": "RPO",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "QB1",
      "HB1"
    ],
    "secondaryPositions": [
      "WR1",
      "TE1"
    ],
    "requiredAttributes": [
      "awareness",
      "shortAccuracy",
      "throwOnRun"
    ],
    "riskLevel": "low",
    "objective": "pressure answer"
  },
  {
    "id": "y-sail",
    "name": "Y-Sail",
    "formation": "Shotgun",
    "family": "intermediate",
    "baseScore": 82,
    "situations": [
      "medium",
      "long"
    ],
    "conceptFamily": "intermediate pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 3,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "WR1",
      "TE1",
      "WR2"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "routeRunning",
      "catching",
      "awareness"
    ],
    "riskLevel": "medium",
    "objective": "move chains"
  },
  {
    "id": "exit-pa-smash",
    "name": "Exit PA Smash",
    "formation": "Shotgun",
    "family": "play_action",
    "baseScore": 78,
    "situations": [
      "medium",
      "long"
    ],
    "conceptFamily": "play action",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "QB1",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "HB1"
    ],
    "requiredAttributes": [
      "playAction",
      "throwOnRun",
      "awareness",
      "throwUnderPressure"
    ],
    "riskLevel": "medium",
    "objective": "move chains"
  },
  {
    "id": "slot-fade",
    "name": "Slot Fade",
    "formation": "Shotgun",
    "family": "deep",
    "baseScore": 74,
    "situations": [
      "red_zone",
      "long"
    ],
    "conceptFamily": "deep pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 7,
    "maxDistance": 99,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "long",
    "primaryPositions": [
      "WR1",
      "WR2"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "speed",
      "acceleration",
      "release",
      "deepRouteRunning",
      "catching"
    ],
    "riskLevel": "high",
    "objective": "red-zone score"
  },
  {
    "id": "y-read-read-option",
    "name": "Y Read Read Option",
    "formation": "Shotgun",
    "family": "option",
    "baseScore": 79,
    "situations": [
      "short",
      "medium"
    ],
    "conceptFamily": "option",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "QB1",
      "HB1"
    ],
    "secondaryPositions": [
      "HB2"
    ],
    "requiredAttributes": [
      "speed",
      "awareness",
      "carrying"
    ],
    "riskLevel": "medium",
    "objective": "move chains"
  },
  {
    "id": "curl-flat",
    "name": "Curl Flat",
    "formation": "Shotgun",
    "family": "quick",
    "baseScore": 80,
    "situations": [
      "medium",
      "two_minute"
    ],
    "conceptFamily": "quick pass",
    "eligibleDowns": [
      1,
      2,
      3,
      4
    ],
    "minDistance": 1,
    "maxDistance": 6,
    "eligibleFieldZones": [
      "normal",
      "backed_up",
      "fringe",
      "red_zone",
      "goal_line"
    ],
    "eligibleGameStates": [
      "normal",
      "two_minute",
      "protect_lead",
      "must_score"
    ],
    "lineToGainCapability": "medium",
    "primaryPositions": [
      "WR2",
      "TE1",
      "WR1"
    ],
    "secondaryPositions": [
      "QB1"
    ],
    "requiredAttributes": [
      "catching",
      "routeRunning",
      "awareness"
    ],
    "riskLevel": "low",
    "objective": "move chains"
  }
];
