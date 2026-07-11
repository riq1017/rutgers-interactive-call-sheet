const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

const teamNeeds = readJson("team_needs.json");
const recruits = readJson("recruits.json");
const roster = readJson("roster.json");
const settings = readJson("recruiting_settings.json");

const opponent = {
  name: roster.season_context?.opponent || "Purdue",
  week: roster.season_context?.week || 6,
  rutgers_record: roster.season_context?.record || "5-0",
  source: "data/roster.json season_context and current weekly package",
  verification_status: "verified_from_structured_package"
};

const teamProfile = {
  team: "Rutgers",
  app_name: "Gameday Gameplan",
  week: roster.season_context?.week || 6,
  record: roster.season_context?.record || "5-0",
  opponent: roster.season_context?.opponent || "Purdue",
  rutgers_rank: "#18",
  offense_rank: 22,
  defense_rank: 19,
  momentum_status: "High",
  scheme: null,
  prestige: null,
  team_summary_observed: roster.team_summary_observed || null,
  verification_status: "source_package_context_and_approved_ui_reference",
  source_file: roster.source_file || null,
  ui_reference: "ChatGPT Image Jul 11, 2026, 05_45_48 PM.png"
};

const recruitingBoard = {
  team: recruits.team,
  source_type: recruits.source_type,
  source_file: recruits.source_file,
  board_order_source: "recruits.prospects.board_order_observed",
  entries: recruits.prospects.map(prospect => ({
    prospect_id: prospect.id,
    board_order_observed: prospect.board_order_observed,
    position: prospect.position,
    scholarship_offered: prospect.scholarship_offered,
    hours_assigned: prospect.hours_assigned,
    visit_status: prospect.visit_status,
    recruiting_stage: prospect.recruiting_stage,
    recommended_action: prospect.recommended_action,
    action_history: [],
    verification_status: prospect.verification_status,
    source_frame: prospect.source_frame
  }))
};

const recruitingPerformance = {
  team: "Rutgers",
  missing_metric_behavior: settings.missing_metric_behavior || "neutral",
  metrics: {
    pass_protection: null,
    rushing_efficiency: null,
    explosive_passing: null,
    pressure_rate: null,
    missed_tackles: null,
    coverage_breakdowns: null,
    red_zone_efficiency: null,
    future_depth: null
  },
  available_context: {
    team_yards_per_carry: 5.39,
    team_yards_per_attempt: 6.61,
    quarterback_sacks_last_game: 2
  },
  diagnostics: [
    "Most recruiting performance metrics are unavailable in the structured package and must remain neutral.",
    "Available gameplan context is informational and does not create fabricated recruiting ratings."
  ]
};

writeJson("opponent.json", opponent);
writeJson("team_profile.json", teamProfile);
writeJson("recruiting_board.json", recruitingBoard);
writeJson("recruiting_performance.json", recruitingPerformance);

const bundles = {
  TEAM_NEEDS_DATA: teamNeeds,
  RECRUITS_DATA: recruits,
  ROSTER_DATA: roster,
  RECRUITING_SETTINGS: settings,
  RECRUITING_BOARD: recruitingBoard,
  RECRUITING_PERFORMANCE: recruitingPerformance,
  TEAM_PROFILE: teamProfile,
  OPPONENT_DATA: opponent
};

const lines = Object.entries(bundles).map(([name, value]) => `window.${name} = ${JSON.stringify(value, null, 2)};`);
fs.writeFileSync(path.join(dataDir, "recruiting_data.js"), `${lines.join("\n\n")}\n`);
