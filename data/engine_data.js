window.RUTGERS_ROSTER_BASE = {
  "schema_version": "1.0",
  "team": "Rutgers",
  "source_priority": [
    "Rutgers_Recruiting_Engine_5_Video_Seed.zip depth_chart_seed.json",
    "existing corrected Rutgers video-derived roster.json",
    "manual review notes remain unresolved where source fields are null"
  ],
  "data_quality": {
    "rule": "Only values clearly readable from supplied footage are populated.",
    "null_meaning": "Not visible or not confidently readable.",
    "verification_required": true
  },
  "source_video": "IMG_3011.mp4",
  "source_reference": "reference/IMG_3011_roster_depth_chart_contact.jpg",
  "players": [
    {
      "player_id": "roster-qb-m-york",
      "display_name": "M. York",
      "position": "QB",
      "depth_chart_order": null,
      "depth_role": null,
      "overall_displayed": 77,
      "overall_sidebar_boosted": 78,
      "class_year": "FR",
      "redshirt_status": null,
      "height": "6'1\"",
      "weight_lbs": 270,
      "archetype": "Pocket Passer",
      "development_trait": null,
      "injury_status": null,
      "expected_departure": null,
      "scheme_role": null,
      "visible_attributes": {},
      "season_stats": {},
      "last_game_stats": {},
      "source_video": "IMG_2965(3).mp4",
      "source_reference": "reference_frames/roster/roster_01.jpg",
      "verification_status": "high_confidence_from_frame"
    },
    {
      "player_id": "roster-qb-r-bieniemy",
      "display_name": "R. Bieniemy",
      "position": "QB",
      "depth_chart_order": null,
      "depth_role": null,
      "overall_displayed": 77,
      "overall_sidebar_boosted": null,
      "class_year": "SO",
      "redshirt_status": null,
      "height": null,
      "weight_lbs": null,
      "archetype": null,
      "development_trait": null,
      "injury_status": null,
      "expected_departure": null,
      "scheme_role": null,
      "visible_attributes": {},
      "season_stats": {},
      "last_game_stats": {},
      "source_video": "IMG_2965(3).mp4",
      "source_reference": "reference_frames/roster/roster_01.jpg",
      "verification_status": "medium_confidence_from_frame"
    },
    {
      "player_id": "roster-qb-s-warner",
      "display_name": "S. Warner",
      "position": "QB",
      "depth_chart_order": null,
      "depth_role": null,
      "overall_displayed": null,
      "overall_sidebar_boosted": null,
      "class_year": "JR",
      "redshirt_status": "RS",
      "height": null,
      "weight_lbs": null,
      "archetype": null,
      "development_trait": null,
      "injury_status": null,
      "expected_departure": null,
      "scheme_role": null,
      "visible_attributes": {},
      "season_stats": {},
      "last_game_stats": {},
      "source_video": "IMG_2965(3).mp4",
      "source_reference": "reference_frames/roster/roster_01.jpg",
      "verification_status": "medium_confidence_from_frame"
    },
    {
      "player_id": "roster-qb-j-portillo",
      "display_name": "J. Portillo",
      "position": "QB",
      "depth_chart_order": null,
      "depth_role": null,
      "overall_displayed": null,
      "overall_sidebar_boosted": null,
      "class_year": "FR",
      "redshirt_status": null,
      "height": null,
      "weight_lbs": null,
      "archetype": null,
      "development_trait": null,
      "injury_status": null,
      "expected_departure": null,
      "scheme_role": null,
      "visible_attributes": {},
      "season_stats": {},
      "last_game_stats": {},
      "source_video": "IMG_2965(3).mp4",
      "source_reference": "reference_frames/roster/roster_01.jpg",
      "verification_status": "medium_confidence_from_frame"
    }
  ],
  "position_groups": [
    {
      "position": "QB",
      "players": [
        "roster-qb-m-york",
        "roster-qb-r-bieniemy",
        "roster-qb-s-warner",
        "roster-qb-j-portillo"
      ],
      "unresolved": false
    },
    {
      "position": "HB",
      "players": [],
      "unresolved": true
    },
    {
      "position": "WR",
      "players": [],
      "unresolved": true
    },
    {
      "position": "TE",
      "players": [],
      "unresolved": true
    },
    {
      "position": "LT",
      "players": [],
      "unresolved": true
    },
    {
      "position": "LG",
      "players": [],
      "unresolved": true
    },
    {
      "position": "C",
      "players": [],
      "unresolved": true
    },
    {
      "position": "RG",
      "players": [],
      "unresolved": true
    },
    {
      "position": "RT",
      "players": [],
      "unresolved": true
    },
    {
      "position": "EDGE",
      "players": [],
      "unresolved": true
    },
    {
      "position": "DT",
      "players": [],
      "unresolved": true
    },
    {
      "position": "OLB",
      "players": [],
      "unresolved": true
    },
    {
      "position": "MIKE",
      "players": [],
      "unresolved": true
    },
    {
      "position": "CB",
      "players": [],
      "unresolved": true
    },
    {
      "position": "FS",
      "players": [],
      "unresolved": true
    },
    {
      "position": "SS",
      "players": [],
      "unresolved": true
    },
    {
      "position": "K",
      "players": [],
      "unresolved": true
    },
    {
      "position": "P",
      "players": [],
      "unresolved": true
    }
  ],
  "unresolved": {
    "full_depth_chart": "depth_chart_seed.json marks roster/depth chart as manual_transcription_required; no unreadable players were added.",
    "depth_order": "Existing structured roster did not verify depth-chart order; depth_chart_order remains null.",
    "non_qb_positions": "No additional non-QB shared roster rows were machine-readable in the supplied seed JSON."
  }
};

window.GAMEPLAN_WEEKLY = {
  "schema_version": "2.0",
  "package_type": "gameplan_weekly_update",
  "package_name": "Purdue Week 6 Gameplan",
  "week": 6,
  "opponent": "Purdue",
  "last_updated": "This Week",
  "shared_roster_file": "data/rutgers_roster_base.json",
  "quick_tactical_summary": [
    "Interior run and RPO remain the preferred answers when down and distance allow.",
    "Q. Gillians edge pressure makes quick game, screens, movement passes, chips, and boots important.",
    "Deep shots should be protected and situational, not repeated into pressure."
  ],
  "game_day_usage": {
    "target_run_rate": null,
    "target_pass_rate": null,
    "notes": [
      "Use live history, recent-call memory, and verified matchup traits to rotate concepts."
    ]
  },
  "run_direction": [
    {
      "direction": "Inside zone / power",
      "recommendation": "Feature only when eligible by down and distance.",
      "evidence": "Purdue defensive tackles reported mostly low-to-mid 70s."
    },
    {
      "direction": "Outside / counter",
      "recommendation": "Use as constraint and explosive changeup.",
      "evidence": "J. Haskins verified explosive last game in existing weekly package."
    }
  ],
  "protection": [
    {
      "item": "Edge pressure",
      "recommendation": "Use quick game, screens, movement passes, chips, and avoid repeated slow drops.",
      "evidence": "REDG Q. Gillians visible at 84 OVR."
    }
  ],
  "opponent_defense": [
    {
      "unit": "Edge",
      "summary": "Q. Gillians, 84 OVR visible edge threat."
    },
    {
      "unit": "Defensive tackles",
      "summary": "Mostly low-to-mid 70s."
    },
    {
      "unit": "Linebackers",
      "summary": "Mostly low 70s."
    }
  ],
  "matchup_matrix": [
    {
      "rutgers": "Interior run",
      "opponent": "Purdue DTs",
      "fit": "Advantage when situation allows"
    },
    {
      "rutgers": "Quick game / screens",
      "opponent": "Purdue edge pressure",
      "fit": "Protection answer"
    },
    {
      "rutgers": "TE middle field",
      "opponent": "Purdue LBs",
      "fit": "Matchup stress point"
    }
  ],
  "alerts": [
    "Do not call consecutive slow-developing dropbacks.",
    "Do not recommend runs on 4th-and-long."
  ]
};

window.RECRUITING_WEEKLY = {
  "schema_version": "2.0",
  "package_type": "recruiting_weekly_update",
  "package_name": "Rutgers Recruiting Engine 5 Video Seed",
  "week": 6,
  "opponent_context": "Purdue",
  "last_updated": "Video seed import",
  "shared_roster_file": "data/rutgers_roster_base.json",
  "recruiting_priority_order": [
    "on_field_performance_and_progress",
    "current_depth_chart",
    "future_depth_and_departures",
    "scheme_fit",
    "game_recommended_targets",
    "recruiting_feasibility"
  ],
  "team_needs": {
    "team": "Rutgers",
    "source_type": "screenshot",
    "source_file": "26F488CE-21AC-4995-928D-9F54CACDDDE4.jpeg",
    "format": "current_targets/recommended_targets",
    "positions": [
      {
        "position": "QB",
        "side": "offense",
        "current_targets": 0,
        "recommended_targets": 3
      },
      {
        "position": "HB",
        "side": "offense",
        "current_targets": 0,
        "recommended_targets": 4
      },
      {
        "position": "FB",
        "side": "offense",
        "current_targets": 0,
        "recommended_targets": 0
      },
      {
        "position": "WR",
        "side": "offense",
        "current_targets": 0,
        "recommended_targets": 3
      },
      {
        "position": "TE",
        "side": "offense",
        "current_targets": 0,
        "recommended_targets": 1
      },
      {
        "position": "T",
        "side": "offense",
        "current_targets": 11,
        "recommended_targets": 5
      },
      {
        "position": "G",
        "side": "offense",
        "current_targets": 0,
        "recommended_targets": 6
      },
      {
        "position": "C",
        "side": "offense",
        "current_targets": 0,
        "recommended_targets": 1
      },
      {
        "position": "EDGE",
        "side": "defense",
        "current_targets": 5,
        "recommended_targets": 3
      },
      {
        "position": "DT",
        "side": "defense",
        "current_targets": 5,
        "recommended_targets": 1
      },
      {
        "position": "OLB",
        "side": "defense",
        "current_targets": 0,
        "recommended_targets": 7
      },
      {
        "position": "MIKE",
        "side": "defense",
        "current_targets": 2,
        "recommended_targets": 0
      },
      {
        "position": "CB",
        "side": "defense",
        "current_targets": 7,
        "recommended_targets": 4
      },
      {
        "position": "FS",
        "side": "defense",
        "current_targets": 5,
        "recommended_targets": 3
      },
      {
        "position": "SS",
        "side": "defense",
        "current_targets": 0,
        "recommended_targets": 2
      },
      {
        "position": "K",
        "side": "special_teams",
        "current_targets": 0,
        "recommended_targets": 0
      },
      {
        "position": "P",
        "side": "special_teams",
        "current_targets": 0,
        "recommended_targets": 0
      }
    ],
    "initial_priority_order": [
      "G",
      "OLB",
      "QB",
      "WR",
      "SS",
      "HB",
      "TE",
      "C"
    ],
    "overcovered_positions": [
      "T",
      "EDGE",
      "DT",
      "CB",
      "FS"
    ],
    "notes": [
      "Game-recommended needs are a baseline, not the final priority model.",
      "Final priority must also use current team performance, roster depth, future losses, scheme fit, and recruiting feasibility."
    ]
  },
  "recruiting_board": {
    "team": "Rutgers",
    "source_type": "video",
    "source_file": "IMG_2984.mp4",
    "board_order_source": "recruits.prospects.board_order_observed",
    "entries": [
      {
        "prospect_id": "video-prospect-01-tanner",
        "board_order_observed": 1,
        "position": "T",
        "scholarship_offered": null,
        "hours_assigned": null,
        "visit_status": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "action_history": [],
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_01.jpg"
      },
      {
        "prospect_id": "video-prospect-02-simons",
        "board_order_observed": 2,
        "position": "T",
        "scholarship_offered": null,
        "hours_assigned": null,
        "visit_status": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "action_history": [],
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_02.jpg"
      },
      {
        "prospect_id": "video-prospect-03-merling",
        "board_order_observed": 3,
        "position": "T",
        "scholarship_offered": null,
        "hours_assigned": null,
        "visit_status": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "action_history": [],
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_03.jpg"
      },
      {
        "prospect_id": "video-prospect-04-larocque",
        "board_order_observed": 4,
        "position": "T",
        "scholarship_offered": null,
        "hours_assigned": null,
        "visit_status": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "action_history": [],
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_04.jpg"
      },
      {
        "prospect_id": "video-prospect-05-isaac",
        "board_order_observed": 5,
        "position": "T",
        "scholarship_offered": null,
        "hours_assigned": null,
        "visit_status": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "action_history": [],
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_05.jpg"
      },
      {
        "prospect_id": "video-prospect-06-cummins",
        "board_order_observed": 6,
        "position": "T",
        "scholarship_offered": null,
        "hours_assigned": null,
        "visit_status": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "action_history": [],
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_06.jpg"
      },
      {
        "prospect_id": "video-prospect-07-hills",
        "board_order_observed": 7,
        "position": "EDGE",
        "scholarship_offered": null,
        "hours_assigned": null,
        "visit_status": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "action_history": [],
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_07.jpg"
      },
      {
        "prospect_id": "video-prospect-08-scheffler",
        "board_order_observed": 8,
        "position": "EDGE",
        "scholarship_offered": null,
        "hours_assigned": null,
        "visit_status": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "action_history": [],
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_08.jpg"
      },
      {
        "prospect_id": "video-prospect-09-rust",
        "board_order_observed": 9,
        "position": "DT",
        "scholarship_offered": null,
        "hours_assigned": null,
        "visit_status": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "action_history": [],
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_09.jpg"
      },
      {
        "prospect_id": "video-prospect-10-witt",
        "board_order_observed": 10,
        "position": null,
        "scholarship_offered": null,
        "hours_assigned": null,
        "visit_status": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "action_history": [],
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_10.jpg"
      },
      {
        "prospect_id": "video-prospect-11-simms",
        "board_order_observed": 11,
        "position": "CB",
        "scholarship_offered": null,
        "hours_assigned": null,
        "visit_status": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "action_history": [],
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_11.jpg"
      },
      {
        "prospect_id": "video-prospect-12-barnes",
        "board_order_observed": 12,
        "position": "CB",
        "scholarship_offered": null,
        "hours_assigned": null,
        "visit_status": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "action_history": [],
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_12.jpg"
      },
      {
        "prospect_id": "video-prospect-13-ahlers",
        "board_order_observed": 13,
        "position": null,
        "scholarship_offered": null,
        "hours_assigned": null,
        "visit_status": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "action_history": [],
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_13.jpg"
      }
    ]
  },
  "recruits": {
    "team": "Rutgers",
    "source_type": "video",
    "source_file": "IMG_2984.mp4",
    "data_quality": {
      "rule": "Do not invent unreadable values.",
      "null_meaning": "Not visible or not confidently readable from supplied footage.",
      "verification_required": true
    },
    "prospects": [
      {
        "id": "video-prospect-01-tanner",
        "display_name": "TANNER",
        "first_name": null,
        "last_name": "TANNER",
        "position": "T",
        "board_order_observed": 1,
        "stars": null,
        "national_rank": null,
        "position_rank": null,
        "height": null,
        "weight": null,
        "state": null,
        "pipeline": null,
        "interest_level": null,
        "scholarship_offered": null,
        "scouting_percent": null,
        "gem_bust": null,
        "hours_assigned": null,
        "visit_status": null,
        "top_schools": [],
        "rutgers_school_rank": null,
        "dealbreaker": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "confidence": "high",
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_01.jpg"
      },
      {
        "id": "video-prospect-02-simons",
        "display_name": "SIMONS",
        "first_name": null,
        "last_name": "SIMONS",
        "position": "T",
        "board_order_observed": 2,
        "stars": null,
        "national_rank": null,
        "position_rank": null,
        "height": null,
        "weight": null,
        "state": null,
        "pipeline": null,
        "interest_level": null,
        "scholarship_offered": null,
        "scouting_percent": null,
        "gem_bust": null,
        "hours_assigned": null,
        "visit_status": null,
        "top_schools": [],
        "rutgers_school_rank": null,
        "dealbreaker": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "confidence": "high",
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_02.jpg"
      },
      {
        "id": "video-prospect-03-merling",
        "display_name": "MERLING",
        "first_name": null,
        "last_name": "MERLING",
        "position": "T",
        "board_order_observed": 3,
        "stars": null,
        "national_rank": null,
        "position_rank": null,
        "height": null,
        "weight": null,
        "state": null,
        "pipeline": null,
        "interest_level": null,
        "scholarship_offered": null,
        "scouting_percent": null,
        "gem_bust": null,
        "hours_assigned": null,
        "visit_status": null,
        "top_schools": [],
        "rutgers_school_rank": null,
        "dealbreaker": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "confidence": "high",
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_03.jpg"
      },
      {
        "id": "video-prospect-04-larocque",
        "display_name": "LAROCQUE",
        "first_name": null,
        "last_name": "LAROCQUE",
        "position": "T",
        "board_order_observed": 4,
        "stars": null,
        "national_rank": null,
        "position_rank": null,
        "height": null,
        "weight": null,
        "state": null,
        "pipeline": null,
        "interest_level": null,
        "scholarship_offered": null,
        "scouting_percent": null,
        "gem_bust": null,
        "hours_assigned": null,
        "visit_status": null,
        "top_schools": [],
        "rutgers_school_rank": null,
        "dealbreaker": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "confidence": "high",
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_04.jpg"
      },
      {
        "id": "video-prospect-05-isaac",
        "display_name": "ISAAC",
        "first_name": null,
        "last_name": "ISAAC",
        "position": "T",
        "board_order_observed": 5,
        "stars": null,
        "national_rank": null,
        "position_rank": null,
        "height": null,
        "weight": null,
        "state": null,
        "pipeline": null,
        "interest_level": null,
        "scholarship_offered": null,
        "scouting_percent": null,
        "gem_bust": null,
        "hours_assigned": null,
        "visit_status": null,
        "top_schools": [],
        "rutgers_school_rank": null,
        "dealbreaker": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "confidence": "high",
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_05.jpg"
      },
      {
        "id": "video-prospect-06-cummins",
        "display_name": "CUMMINS",
        "first_name": null,
        "last_name": "CUMMINS",
        "position": "T",
        "board_order_observed": 6,
        "stars": null,
        "national_rank": null,
        "position_rank": null,
        "height": null,
        "weight": null,
        "state": null,
        "pipeline": null,
        "interest_level": null,
        "scholarship_offered": null,
        "scouting_percent": null,
        "gem_bust": null,
        "hours_assigned": null,
        "visit_status": null,
        "top_schools": [],
        "rutgers_school_rank": null,
        "dealbreaker": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "confidence": "high",
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_06.jpg"
      },
      {
        "id": "video-prospect-07-hills",
        "display_name": "HILLS",
        "first_name": null,
        "last_name": "HILLS",
        "position": "EDGE",
        "board_order_observed": 7,
        "stars": null,
        "national_rank": null,
        "position_rank": null,
        "height": null,
        "weight": null,
        "state": null,
        "pipeline": null,
        "interest_level": null,
        "scholarship_offered": null,
        "scouting_percent": null,
        "gem_bust": null,
        "hours_assigned": null,
        "visit_status": null,
        "top_schools": [],
        "rutgers_school_rank": null,
        "dealbreaker": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "confidence": "high",
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_07.jpg"
      },
      {
        "id": "video-prospect-08-scheffler",
        "display_name": "SCHEFFLER",
        "first_name": null,
        "last_name": "SCHEFFLER",
        "position": "EDGE",
        "board_order_observed": 8,
        "stars": null,
        "national_rank": null,
        "position_rank": null,
        "height": null,
        "weight": null,
        "state": null,
        "pipeline": null,
        "interest_level": null,
        "scholarship_offered": null,
        "scouting_percent": null,
        "gem_bust": null,
        "hours_assigned": null,
        "visit_status": null,
        "top_schools": [],
        "rutgers_school_rank": null,
        "dealbreaker": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "confidence": "high",
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_08.jpg"
      },
      {
        "id": "video-prospect-09-rust",
        "display_name": "RUST",
        "first_name": null,
        "last_name": "RUST",
        "position": "DT",
        "board_order_observed": 9,
        "stars": null,
        "national_rank": null,
        "position_rank": null,
        "height": null,
        "weight": null,
        "state": null,
        "pipeline": null,
        "interest_level": null,
        "scholarship_offered": null,
        "scouting_percent": null,
        "gem_bust": null,
        "hours_assigned": null,
        "visit_status": null,
        "top_schools": [],
        "rutgers_school_rank": null,
        "dealbreaker": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "confidence": "high",
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_09.jpg"
      },
      {
        "id": "video-prospect-10-witt",
        "display_name": "WITT",
        "first_name": null,
        "last_name": "WITT",
        "position": null,
        "board_order_observed": 10,
        "stars": null,
        "national_rank": null,
        "position_rank": null,
        "height": null,
        "weight": null,
        "state": null,
        "pipeline": null,
        "interest_level": null,
        "scholarship_offered": null,
        "scouting_percent": null,
        "gem_bust": null,
        "hours_assigned": null,
        "visit_status": null,
        "top_schools": [],
        "rutgers_school_rank": null,
        "dealbreaker": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "confidence": "high",
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_10.jpg"
      },
      {
        "id": "video-prospect-11-simms",
        "display_name": "SIMMS",
        "first_name": null,
        "last_name": "SIMMS",
        "position": "CB",
        "board_order_observed": 11,
        "stars": null,
        "national_rank": null,
        "position_rank": null,
        "height": null,
        "weight": null,
        "state": null,
        "pipeline": null,
        "interest_level": null,
        "scholarship_offered": null,
        "scouting_percent": null,
        "gem_bust": null,
        "hours_assigned": null,
        "visit_status": null,
        "top_schools": [],
        "rutgers_school_rank": null,
        "dealbreaker": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "confidence": "high",
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_11.jpg"
      },
      {
        "id": "video-prospect-12-barnes",
        "display_name": "BARNES",
        "first_name": null,
        "last_name": "BARNES",
        "position": "CB",
        "board_order_observed": 12,
        "stars": null,
        "national_rank": null,
        "position_rank": null,
        "height": null,
        "weight": null,
        "state": null,
        "pipeline": null,
        "interest_level": null,
        "scholarship_offered": null,
        "scouting_percent": null,
        "gem_bust": null,
        "hours_assigned": null,
        "visit_status": null,
        "top_schools": [],
        "rutgers_school_rank": null,
        "dealbreaker": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "confidence": "high",
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_12.jpg"
      },
      {
        "id": "video-prospect-13-ahlers",
        "display_name": "AHLERS",
        "first_name": null,
        "last_name": "AHLERS",
        "position": null,
        "board_order_observed": 13,
        "stars": null,
        "national_rank": null,
        "position_rank": null,
        "height": null,
        "weight": null,
        "state": null,
        "pipeline": null,
        "interest_level": null,
        "scholarship_offered": null,
        "scouting_percent": null,
        "gem_bust": null,
        "hours_assigned": null,
        "visit_status": null,
        "top_schools": [],
        "rutgers_school_rank": null,
        "dealbreaker": null,
        "recruiting_stage": null,
        "recommended_action": null,
        "confidence": "high",
        "verification_status": "name_visible_other_fields_need_review",
        "source_frame": "recruit_13.jpg"
      }
    ]
  },
  "recruiting_settings": {
    "priority_weights": {
      "roster_need": 22,
      "current_performance_need": 22,
      "future_depth_risk": 16,
      "scheme_fit": 12,
      "talent_upgrade_potential": 10,
      "signing_probability": 8,
      "pipeline_strength": 5,
      "interest_level": 5,
      "existing_board_coverage_penalty": -12,
      "recruiting_cost_penalty": -4,
      "competition_difficulty_penalty": -4
    },
    "missing_metric_behavior": "neutral",
    "notes": [
      "Weights are initial defaults and must remain editable.",
      "Do not assign non-neutral performance values when source metrics are unavailable."
    ]
  },
  "recruiting_performance": {
    "team": "Rutgers",
    "missing_metric_behavior": "neutral",
    "metrics": {
      "pass_protection": null,
      "rushing_efficiency": null,
      "explosive_passing": null,
      "pressure_rate": null,
      "missed_tackles": null,
      "coverage_breakdowns": null,
      "red_zone_efficiency": null,
      "future_depth": null
    },
    "available_context": {
      "team_yards_per_carry": 5.39,
      "team_yards_per_attempt": 6.61,
      "quarterback_sacks_last_game": 2
    },
    "diagnostics": [
      "Most recruiting performance metrics are unavailable in the structured package and must remain neutral.",
      "Available gameplan context is informational and does not create fabricated recruiting ratings."
    ]
  },
  "weekly_actions": [],
  "unresolved": {
    "prospect_details": "Seed package preserves null for unreadable position, stars, rankings, interest, visits, and scouting fields.",
    "coach_abilities": "Exact tiers and point values remain unresolved."
  }
};

window.ROSTER_BASE_SCHEMA = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ROSTER_BASE_SCHEMA",
  "type": "object",
  "required": [
    "schema_version",
    "team",
    "players",
    "position_groups"
  ],
  "properties": {
    "schema_version": {
      "type": "string"
    },
    "team": {
      "type": "string"
    },
    "players": {
      "type": "array"
    },
    "position_groups": {
      "type": "array"
    },
    "unresolved": {
      "type": "object"
    }
  },
  "additionalProperties": true
};
window.GAMEPLAN_WEEKLY_SCHEMA_V2 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "GAMEPLAN_WEEKLY_SCHEMA_v2",
  "type": "object",
  "required": [
    "schema_version",
    "package_type",
    "package_name",
    "week",
    "opponent",
    "shared_roster_file"
  ],
  "properties": {
    "schema_version": {
      "const": "2.0"
    },
    "package_type": {
      "const": "gameplan_weekly_update"
    },
    "package_name": {
      "type": "string"
    },
    "week": {
      "type": [
        "number",
        "string"
      ]
    },
    "opponent": {
      "type": "string"
    },
    "shared_roster_file": {
      "const": "data/rutgers_roster_base.json"
    }
  },
  "additionalProperties": true
};
window.RECRUITING_WEEKLY_SCHEMA_V2 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "RECRUITING_WEEKLY_SCHEMA_v2",
  "type": "object",
  "required": [
    "schema_version",
    "package_type",
    "package_name",
    "shared_roster_file",
    "recruiting_priority_order"
  ],
  "properties": {
    "schema_version": {
      "const": "2.0"
    },
    "package_type": {
      "const": "recruiting_weekly_update"
    },
    "package_name": {
      "type": "string"
    },
    "shared_roster_file": {
      "const": "data/rutgers_roster_base.json"
    },
    "recruiting_priority_order": {
      "type": "array"
    }
  },
  "additionalProperties": true
};
