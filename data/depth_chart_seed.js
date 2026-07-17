window.RUTGERS_DEPTH_CHART_SEED = {
  "schema_version": "1.0",
  "team": "Rutgers",
  "source_video": "IMG_3011.mp4",
  "source_reference": "reference/IMG_3011_roster_depth_chart_contact.jpg",
  "status": "manual_depth_chart_validated_against_current_roster",
  "position_groups": [
    {
      "position": "QB",
      "players": [],
      "status": "unavailable_requires_manual_verification"
    },
    {
      "position": "HB",
      "players": [],
      "status": "unavailable_requires_manual_verification"
    },
    {
      "position": "WR",
      "players": [],
      "status": "unavailable_requires_manual_verification"
    },
    {
      "position": "TE",
      "players": [],
      "status": "unavailable_requires_manual_verification"
    },
    {
      "position": "LT",
      "players": [
        {
          "player_id": "3214",
          "name": "J. Elijah",
          "position": "LT",
          "depth_order": 1,
          "depth_role": "Starting offensive lineman",
          "overall": 67,
          "class_year": "Sophomore",
          "development_trait": null,
          "verification_status": "manual_static_validated_against_current_roster",
          "save_player_id": 3214,
          "full_name": "Jayden Elijah",
          "validation_match": "matched_current_roster_by_name_and_position"
        }
      ]
    },
    {
      "position": "LG",
      "players": [
        {
          "player_id": "13808",
          "name": "C. Lantz",
          "position": "LG",
          "depth_order": 1,
          "depth_role": "Developmental/rotation lineman",
          "overall": 65,
          "class_year": "Freshman",
          "development_trait": null,
          "verification_status": "manual_static_validated_against_current_roster",
          "save_player_id": 13808,
          "full_name": "Chase Lantz",
          "validation_match": "matched_current_roster_by_name_and_position"
        }
      ]
    },
    {
      "position": "C",
      "players": [],
      "status": "unavailable_requires_manual_verification"
    },
    {
      "position": "RG",
      "players": [],
      "status": "unavailable_requires_manual_verification"
    },
    {
      "position": "RT",
      "players": [
        {
          "player_id": "7872",
          "name": "B. Newberry",
          "position": "RT",
          "depth_order": 1,
          "depth_role": "Developmental/rotation lineman",
          "overall": 66,
          "class_year": "Freshman",
          "development_trait": null,
          "verification_status": "manual_static_validated_against_current_roster",
          "save_player_id": 7872,
          "full_name": "B.J. Newberry",
          "validation_match": "matched_current_roster_by_name_and_position"
        }
      ]
    },
    {
      "position": "EDGE",
      "players": [],
      "status": "unavailable_requires_manual_verification"
    },
    {
      "position": "DT",
      "players": [],
      "status": "unavailable_requires_manual_verification"
    },
    {
      "position": "OLB",
      "players": [],
      "status": "unavailable_requires_manual_verification"
    },
    {
      "position": "MIKE",
      "players": [],
      "status": "unavailable_requires_manual_verification"
    },
    {
      "position": "CB",
      "players": [],
      "status": "unavailable_requires_manual_verification"
    },
    {
      "position": "FS",
      "players": [],
      "status": "unavailable_requires_manual_verification"
    },
    {
      "position": "SS",
      "players": [],
      "status": "unavailable_requires_manual_verification"
    },
    {
      "position": "K",
      "players": [],
      "status": "unavailable_requires_manual_verification"
    },
    {
      "position": "P",
      "players": [],
      "status": "unavailable_requires_manual_verification"
    }
  ],
  "player_schema": {
    "name": null,
    "position": null,
    "depth_order": null,
    "overall": null,
    "class_year": null,
    "redshirt": null,
    "development_trait": null,
    "archetype": null,
    "injury_status": null,
    "expected_departure": null,
    "verification_status": "unreviewed"
  },
  "codex_instruction": "Review the original video/contact sheet and populate only clearly readable players. Leave unclear values null.",
  "updated_for": "identity_join_correction",
  "validation": {
    "current_roster_player_count": 85,
    "validated_entries": 3,
    "rejected_entries": 2,
    "rule": "Only manual entries resolving to the current parser-derived Rutgers roster are retained.",
    "validated_count": 3,
    "rejected_count": 2,
    "validated_entries_detail": [
      {
        "slot": "LT",
        "player_id": "3214",
        "name": "J. Elijah",
        "position": "LT",
        "match": "matched_current_roster_by_name_and_position"
      },
      {
        "slot": "LG",
        "player_id": "13808",
        "name": "C. Lantz",
        "position": "LG",
        "match": "matched_current_roster_by_name_and_position"
      },
      {
        "slot": "RT",
        "player_id": "7872",
        "name": "B. Newberry",
        "position": "RT",
        "match": "matched_current_roster_by_name_and_position"
      }
    ],
    "rejected_entries_detail": [
      {
        "slot": "C",
        "player_id": "d-sturgis-c",
        "name": "D. Sturgis",
        "position": "C",
        "reason": "not_present_in_current_85_player_roster"
      },
      {
        "slot": "RG",
        "player_id": "j-felton-rg",
        "name": "J. Felton",
        "position": "RG",
        "reason": "not_present_in_current_85_player_roster"
      }
    ],
    "source": "data/depth_chart_seed.json"
  }
};
