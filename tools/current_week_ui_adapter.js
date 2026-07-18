const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "data", "parser_coverage", "current_week", "integration_candidate");
const outputDir = path.join(root, "data", "parser_coverage", "current_week", "ui_preview");
const read = name => JSON.parse(fs.readFileSync(path.join(sourceDir, name), "utf8"));

function legacyPlayer(player, statsById, lastStatsById, injuriesById) {
  const injury = injuriesById.get(player.playerId);
  return {
    ...player,
    player_id: String(player.playerId),
    name: player.displayName,
    jersey: player.jerseyNumber,
    class_year: player.schoolYear,
    development_trait: player.developmentTrait,
    redshirt_status: player.redshirtState,
    injury_status: injury ? injury.type : "Healthy",
    injury_details: injury ? injury.severity : "",
    attributes: player.ratings,
    season_statistics: statsById.get(player.playerId) || {},
    latest_game_statistics: lastStatsById.get(player.playerId) || {}
  };
}

function categorizedStats(rows) {
  const result = { passing: [], rushing: [], receiving: [], defense: [] };
  for (const row of rows) {
    const base = { player_id: String(row.playerId), name: `${row.firstName || ""} ${row.lastName || ""}`.trim() };
    if (row.offense?.passAttempts || row.offense?.passYards) result.passing.push({ ...base, ...row.offense, yards: row.offense.passYards });
    if (row.offense?.rushAttempts || row.offense?.rushYards) result.rushing.push({ ...base, ...row.offense, yards: row.offense.rushYards });
    if (row.offense?.receptions || row.offense?.recYards) result.receiving.push({ ...base, ...row.offense, yards: row.offense.recYards });
    if (row.defense && Object.keys(row.defense).length) result.defense.push({ ...base, ...row.defense });
  }
  return result;
}

function adaptNormalizedCandidate(normalized) {
  const context = normalized.currentContext;
  const roster = normalized.rutgersRoster;
  const stats = normalized.rutgersPlayerStatistics;
  const teamStats = normalized.rutgersTeamStatistics;
  const leaders = normalized.rutgersTeamLeaders;
  const lastGame = normalized.lastGame;
  const injuries = normalized.rutgersInjuries;
  const interest = normalized.recruiting.rutgersInterestPool;
  const activeBoard = normalized.recruiting.rutgersActiveBoard;
  const opponent = normalized.opponent;
  const statsById = new Map(stats.map(row => [row.playerId, row]));
  const lastRows = lastGame.allRutgersPlayerStatistics || Object.values(lastGame.playerStatistics || {}).flat();
  const lastStatsById = new Map(lastRows.map(row => [row.playerId, row]));
  const injuriesById = new Map(injuries.records.map(row => [row.playerId, row]));
  const players = roster.players.map(row => legacyPlayer(row, statsById, lastStatsById, injuriesById));
  return {
    schema_version: "current_week_ui_preview_v1",
    preview_only: false,
    generated: true,
    generated_from: "verified snapshot parser export",
    current_context: context,
    roster: { team: { team: "Rutgers", season: context.season, record: context.rutgers.record }, count: players.length, players },
    player_details: Object.fromEntries(players.map(row => [row.player_id, row])),
    season_stats: categorizedStats(stats),
    team_statistics: teamStats,
    team_leaders: leaders,
    last_game: lastGame,
    injuries,
    availability: normalized.availability,
    recruiting: { available: normalized.recruiting.available !== false, label: normalized.recruiting.label || "Rutgers Interest Pool", reason: normalized.recruiting.reason || null, interest_pool: interest, active_board: activeBoard, ownership_resolved: false },
    opponent: { ...opponent, name: context.opponentLabel },
    matchup: normalized.availability?.matchups || { available: false, reason: "Player-level matchups are unavailable for FCS placeholder teams." }
  };
}

function buildCandidate() {
  return adaptNormalizedCandidate(read("normalized_current_week.json"));
}

function writeCandidate(candidate = buildCandidate()) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "app_candidate_data.json");
  const jsPath = path.join(outputDir, "app_candidate_data.js");
  fs.writeFileSync(jsonPath, `${JSON.stringify(candidate, null, 2)}\n`);
  fs.writeFileSync(jsPath, `window.CURRENT_WEEK_UI_PREVIEW = ${JSON.stringify(candidate)};\n`);
  return { jsonPath, jsPath, candidate };
}

if (require.main === module) {
  const result = writeCandidate();
  console.log(`Wrote ${result.jsonPath}`);
  console.log(`Wrote ${result.jsPath}`);
}

module.exports = { adaptNormalizedCandidate, buildCandidate, categorizedStats, legacyPlayer, writeCandidate };
