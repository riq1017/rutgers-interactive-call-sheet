#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const BASE = path.join(ROOT, "data", "parser_coverage", "current_week");
const RAW_PATH = path.join(BASE, "raw", "full_parser_export.json");
const PROVENANCE_PATH = path.join(BASE, "raw", "provenance_manifest.json");
const SNAPSHOT_MANIFEST_PATH = path.join(BASE, "raw", "snapshot_manifest.json");
const OUTPUT_DIR = path.join(BASE, "integration_candidate");
const SCHEMA_PATH = path.join(ROOT, "schemas", "current_week_candidate.schema.json");
const RUTGERS_ID = 78;
const STALE_OPPONENTS = new Set(["UMass", "Boston College", "USC", "Purdue"]);
const FCS_REASON = "FCS placeholder teams are not exposed as normal parser team entities.";

function hash(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function gameDate(game) { return (Number(game.gameDateMonth) || 0) * 100 + (Number(game.gameDateDay) || 0); }
function isPlayed(game) { return Boolean(game.status) && game.status !== "Unplayed"; }
function opponentName(game) { return game.homeTeam === "Rutgers" ? game.awayTeam : game.homeTeam; }
function fullName(player) { return `${player.firstName || ""} ${player.lastName || ""}`.trim(); }
function playerTeamId(row) { return row && row.player && row.player.teamIndex != null ? row.player.teamIndex : row && row.teamId; }
function valueAt(row, dotted) { return dotted.split(".").reduce((value, key) => value == null ? undefined : value[key], row); }

function verifySources() {
  const provenance = JSON.parse(fs.readFileSync(PROVENANCE_PATH, "utf8"));
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_MANIFEST_PATH, "utf8"));
  if (provenance.snapshotSha256 !== snapshot.snapshotSha256 || snapshot.sourceSha256Before !== snapshot.sourceSha256After || snapshot.sourceSha256After !== snapshot.snapshotSha256) throw new Error("STOP: current-week source provenance cannot be verified");
  if (hash(RAW_PATH) !== hash(RAW_PATH)) throw new Error("STOP: raw export changed during verification");
  if (!path.resolve(RAW_PATH).startsWith(path.resolve(BASE)) || !path.resolve(OUTPUT_DIR).startsWith(path.resolve(BASE))) throw new Error("STOP: candidate path is not isolated");
  return { provenance, snapshot, rawSha256: hash(RAW_PATH) };
}

function dynastyContext(raw) {
  const rutgers = (raw.teams || []).find(team => Number(team.id) === RUTGERS_ID && (team.displayName === "Rutgers" || team.longName === "Rutgers"));
  if (!rutgers || !Number.isFinite(Number(raw.season && raw.season.year)) || !Number.isFinite(Number(raw.season && raw.season.week))) throw new Error("STOP: current week or Rutgers identity is ambiguous");
  const schedule = (raw.games || []).filter(game => game.homeTeam === "Rutgers" || game.awayTeam === "Rutgers").sort((a, b) => gameDate(a) - gameDate(b));
  const completed = schedule.filter(isPlayed);
  const future = schedule.filter(game => !isPlayed(game));
  const last = completed.at(-1);
  const next = future[0];
  if (!last || !next) throw new Error("STOP: completed/current schedule context is unavailable");
  return { rutgers, schedule, completed, future, last, next };
}

function normalizeGame(game) {
  if (!game) return null;
  const rutgersHome = game.homeTeam === "Rutgers";
  const rutgersScore = rutgersHome ? game.homeScore : game.awayScore;
  const opponentScore = rutgersHome ? game.awayScore : game.homeScore;
  return { sourceGameId: game.id, week: game.week, weekType: game.weekType, opponent: opponentName(game), homeAway: rutgersHome ? "home" : "away", rutgersScore: isPlayed(game) ? rutgersScore : null, opponentScore: isPlayed(game) ? opponentScore : null, result: isPlayed(game) ? (rutgersScore > opponentScore ? "W" : rutgersScore < opponentScore ? "L" : "T") : null, status: game.status };
}

function normalizePlayer(player, seasonStat, latestStat, injury) {
  const known = new Set(["id","firstName","lastName","position","jersey","schoolYear","height","weight","homeTown","homeState","archetype","archetypeLabel","devTrait","redshirtStatus","injuryStatus","overall","ratings"]);
  return {
    playerId: player.id, firstName: player.firstName || "", lastName: player.lastName || "", displayName: fullName(player), teamId: RUTGERS_ID,
    position: player.position || null, jerseyNumber: player.jersey ?? null, schoolYear: player.schoolYear || null, height: player.height ?? null, weight: player.weight ?? null,
    hometown: player.homeTown || null, homeState: player.homeState || null, archetype: player.archetypeLabel || player.archetype || null, archetypeCode: player.archetype || null,
    developmentTrait: player.devTrait || null, redshirtState: player.redshirtStatus || null, injuryState: injury ? injury.type : (player.injuryStatus || null), overall: player.overall ?? null,
    ratings: clone(player.ratings || {}), seasonStatistics: seasonStat ? clone(seasonStat) : null, latestGameStatistics: latestStat ? clone(latestStat) : null,
    injury: injury ? clone(injury) : null,
    additionalFields: Object.fromEntries(Object.entries(player).filter(([key]) => !known.has(key)).map(([key, value]) => [key, clone(value)]))
  };
}

const LEADER_SPECS = {
  passing: { field: "offense.passYards", stat: "passYards" }, rushing: { field: "offense.rushYards", stat: "rushYards" }, receiving: { field: "offense.recYards", stat: "recYards" },
  tackles: { field: "defense.tackles", stat: "tackles" }, sacks: { field: "defense.sacks", stat: "sacks" }, interceptions: { field: "defense.interceptions", stat: "interceptions" }
};

function calculateLeaders(players) {
  const out = {};
  for (const [category, spec] of Object.entries(LEADER_SPECS)) {
    const ranked = players.map(player => ({ playerId: player.playerId, displayName: player.displayName, position: player.position, stat: spec.stat, value: Number(valueAt(player.seasonStatistics || {}, spec.field) || 0) })).filter(row => row.value > 0).sort((a, b) => b.value - a.value || String(a.displayName).localeCompare(String(b.displayName)) || Number(a.playerId) - Number(b.playerId));
    const top = ranked[0] && ranked[0].value;
    out[category] = { status: top ? "available" : "unavailable", stat: spec.stat, leaders: top ? ranked.filter(row => row.value === top) : [], tiePolicy: "Preserve every player tied at the top value; sort tied rows by displayName then playerId.", unavailableReason: top ? null : `No usable positive ${spec.stat} totals exist.` };
  }
  out.kicking = { status: "unavailable", leaders: [], unavailableReason: "Season player-stat records expose no usable kicking totals." };
  out.returns = { status: "unavailable", leaders: [], unavailableReason: "Season player-stat records expose no usable player return totals." };
  return out;
}

function normalizeLastGame(game, rosterIds) {
  const rutgersHome = game.homeTeam === "Rutgers";
  const rutgersRows = (game.playerGameStats || []).filter(row => Number(playerTeamId(row)) === RUTGERS_ID);
  if (!rutgersRows.every(row => rosterIds.has(Number(row.playerId)))) throw new Error("STOP: last-game player-stat joins are unreliable");
  const categorized = key => rutgersRows.filter(row => row[key] && Object.values(row[key]).some(value => Number(value) > 0)).map(clone);
  return {
    ...normalizeGame(game), finalScore: { rutgers: normalizeGame(game).rutgersScore, opponent: normalizeGame(game).opponentScore },
    teamStatistics: { rutgers: clone(rutgersHome ? game.homeTeamStats : game.awayTeamStats), opponent: clone(rutgersHome ? game.awayTeamStats : game.homeTeamStats) },
    playerStatistics: { passing: categorized("offense").filter(row => Number(row.offense.passAttempts) > 0), rushing: categorized("offense").filter(row => Number(row.offense.rushAttempts) > 0), receiving: categorized("offense").filter(row => Number(row.offense.receptions) > 0), defense: categorized("defense"), kicking: categorized("kicking"), returns: categorized("returns") },
    allRutgersPlayerStatistics: rutgersRows.map(clone), kickingStatistics: clone(game.kickingStats || []), returnStatisticsAvailable: rutgersRows.some(row => row.returns), joinStatus: "valid"
  };
}

function normalizeProspect(prospect, pursuit) {
  const player = prospect.player || {};
  const interest = (pursuit.schoolInterest || prospect.schoolInterest || []).find(row => Number(row.teamId) === RUTGERS_ID) || null;
  return { recruitId: prospect.id, firstName: player.firstName || null, lastName: player.lastName || null, displayName: fullName(player), stars: player.starRating || null, nationalRank: prospect.nationalRank ?? null, positionRank: prospect.positionRank ?? null, position: player.position || null, archetype: player.archetypeLabel || player.archetype || null, overall: player.overall ?? null, ratings: clone(player.ratings || {}), hometown: player.homeTown || null, state: player.homeState || null, pipeline: player.homePipeline || null, committedSchool: null, scholarshipStatus: pursuit.scholarshipStatus || null, rutgersInterest: clone(interest), rutgersRank: null, visitInformation: clone(pursuit.scheduledVisit || null), pitchInformation: pursuit.swayPitch || null, swayInformation: pursuit.swayPitch || null, recruitingHours: null, nil: { currentOffer: pursuit.currentNilOffer ?? null, expectation: pursuit.nilExpectation ?? null }, dealbreaker: player.recruitingDealbreaker || null, schoolGrades: null, rawRecruit: clone(prospect), rawPursuit: clone(pursuit) };
}

function unavailableCollection(reason) { return { status: "unavailable", ownershipConfidence: "unresolved", reason, evidence: [], records: [] }; }

function normalizeRecruiting(raw) {
  if (!Array.isArray(raw.recruits) || !Array.isArray(raw.recruiting)) {
    const reason = "The current parser export did not emit recruiting domains.";
    const unavailable = unavailableCollection(reason);
    return { available: false, label: "Recruiting data unavailable", reason, globalPool: unavailable, rutgersInterestPool: unavailable, rutgersActiveBoard: unavailableCollection(reason), rutgersOfferedProspects: unavailableCollection(reason), rutgersScheduledVisits: unavailableCollection(reason), rutgersCommittedProspects: unavailableCollection(reason), ownershipAssessment: { confidence: "unresolved", reason, rejectedInference: "Missing recruiting domains cannot support recruiting ownership or records." } };
  }
  const pursuits = new Map((raw.recruiting || []).map(row => [String(row.recruitId), row]));
  const globalPool = (raw.recruits || []).map(prospect => normalizeProspect(prospect, pursuits.get(String(prospect.id)) || {}));
  const interestPool = globalPool.filter(row => row.rutgersInterest && Number(row.rutgersInterest.teamId) === RUTGERS_ID);
  const reason = "Rutgers interest is provable, but the export has no Rutgers-owned board rank, team-specific hours, offer owner, or visit owner. Global scholarshipStatus/scheduledVisit fields cannot establish Rutgers ownership.";
  return { available: true, label: "Rutgers Interest Pool", reason: null, globalPool: { status: "available", records: globalPool }, rutgersInterestPool: { status: "available", ownershipConfidence: "verified_interest_only", evidence: ["schoolInterest[].teamId === 78"], records: interestPool }, rutgersActiveBoard: unavailableCollection(reason), rutgersOfferedProspects: unavailableCollection(reason), rutgersScheduledVisits: unavailableCollection(reason), rutgersCommittedProspects: unavailableCollection("No explicit Rutgers commitment-owner field is exposed in the verified export."), ownershipAssessment: { confidence: "unresolved", reason, rejectedInference: "schoolInterest membership alone is not active-board ownership" } };
}

function opponentAvailability(raw, game) {
  const name = opponentName(game);
  const placeholder = /^FCS(?:\s|$)/i.test(name);
  if (placeholder) return { name, isPlaceholder: true, dataAvailable: false, unavailableReason: FCS_REASON, schedule: normalizeGame(game), teamEntity: null, record: null, roster: [], seasonStatistics: null, leaders: [], injuries: [], depthChart: [], playerMatchups: [] };
  const team = (raw.teams || []).find(row => (row.displayName || row.longName) === name);
  if (!team) throw new Error(`STOP: current opponent entity is unavailable: ${name}`);
  const roster = ((raw.rosters || []).find(row => Number(row.teamId) === Number(team.id)) || {}).players || [];
  return { name, isPlaceholder: false, dataAvailable: true, unavailableReason: null, schedule: normalizeGame(game), teamEntity: clone(team), record: `${Number(team.overallWins || 0)}-${Number(team.overallLosses || 0)}`, roster: clone(roster), seasonStatistics: clone((raw.seasonTeamStats || []).find(row => Number(row.teamId) === Number(team.id)) || null), leaders: [], injuries: clone((raw.injuries || []).filter(row => Number(row.teamId) === Number(team.id))), depthChart: clone((raw.depthCharts || []).filter(row => Number(row.teamId) === Number(team.id))), playerMatchups: [] };
}

function buildCandidate(raw, source) {
  const ctx = dynastyContext(raw);
  const rosterRecord = (raw.rosters || []).find(row => Number(row.teamId) === RUTGERS_ID);
  if (!rosterRecord || !Array.isArray(rosterRecord.players) || !rosterRecord.players.length) throw new Error("STOP: verified Rutgers roster is unavailable");
  const rosterIds = new Set(rosterRecord.players.map(player => Number(player.id)));
  if (rosterIds.size !== rosterRecord.players.length) throw new Error("STOP: Rutgers roster IDs are not unique");
  const seasonStats = (raw.seasonPlayerStats || []).filter(row => Number(row.teamId) === RUTGERS_ID);
  if (!seasonStats.every(row => rosterIds.has(Number(row.playerId)))) throw new Error("STOP: player season-stat joins are unreliable");
  const latestStats = (ctx.last.playerGameStats || []).filter(row => Number(playerTeamId(row)) === RUTGERS_ID);
  const injuries = (raw.injuries || []).filter(row => Number(row.teamId) === RUTGERS_ID);
  const seasonById = new Map(seasonStats.map(row => [Number(row.playerId), row]));
  const latestById = new Map(latestStats.map(row => [Number(row.playerId), row]));
  const injuryById = new Map(injuries.map(row => [Number(row.playerId), row]));
  const players = rosterRecord.players.map(player => normalizePlayer(player, seasonById.get(Number(player.id)), latestById.get(Number(player.id)), injuryById.get(Number(player.id))));
  const normalizedInjuries = injuries.map(row => ({ ...clone(row), playerJoinStatus: rosterIds.has(Number(row.playerId)) ? "joined" : "unmatched" }));
  const opponent = opponentAvailability(raw, ctx.next);
  const teamStats = clone((raw.seasonTeamStats || []).find(row => Number(row.teamId) === RUTGERS_ID) || null);
  const recruiting = normalizeRecruiting(raw);
  const currentContext = { season: raw.season.year, week: raw.season.week, weekType: raw.season.weekType, phase: raw.season.phase, rutgers: { teamId: RUTGERS_ID, name: "Rutgers", wins: ctx.rutgers.overallWins, losses: ctx.rutgers.overallLosses, record: `${ctx.rutgers.overallWins}-${ctx.rutgers.overallLosses}` }, opponentLabel: opponent.name, homeAway: normalizeGame(ctx.next).homeAway, lastCompletedGame: normalizeGame(ctx.last), nextGame: normalizeGame(ctx.next), opponentDataAvailable: opponent.dataAvailable, opponentAvailabilityReason: opponent.unavailableReason };
  const availability = { currentContext: { available: true }, roster: { available: true }, playerDetails: { available: true }, teamStatistics: { available: Boolean(teamStats), reason: teamStats ? null : "The current parser export did not emit Rutgers team statistics." }, leaders: { available: Object.values(calculateLeaders(players)).some(group => group.status === "available") }, lastGame: { available: true }, injuries: { available: Array.isArray(raw.injuries) }, recruiting: { available: recruiting.available, reason: recruiting.reason }, opponent: { available: opponent.dataAvailable, reason: opponent.unavailableReason }, matchups: { available: !opponent.isPlaceholder, reason: opponent.isPlaceholder ? "Player-level matchups are unavailable for FCS placeholder teams." : null } };
  return { schemaVersion: "current_week_candidate_v1", packageType: "current_week_normalized_candidate", previewOnly: true, productionCompatible: true, source: { rawExport: path.relative(ROOT, RAW_PATH).replaceAll("\\", "/"), rawSha256: source.rawSha256, snapshotSha256: source.snapshot.snapshotSha256, parserSha256: source.provenance.parserSha256 }, legacyCompatibility: { existingProductionPackagesModified: false, existingLoaderContractModified: false, sharedRosterFile: "data/rutgers_roster_base.json", additiveOnly: true }, availability, currentContext, rutgersRoster: { teamId: RUTGERS_ID, count: players.length, players }, rutgersPlayerStatistics: seasonStats.map(clone), rutgersTeamStatistics: teamStats, rutgersTeamLeaders: calculateLeaders(players), lastGame: normalizeLastGame(ctx.last, rosterIds), rutgersInjuries: { count: normalizedInjuries.length, records: normalizedInjuries }, recruiting, opponent };
}

function validateCandidate(candidate) {
  const errors = [];
  const ids = candidate.rutgersRoster.players.map(row => row.playerId);
  if (new Set(ids).size !== ids.length) errors.push("duplicate roster IDs");
  if (candidate.currentContext.opponentLabel !== candidate.opponent.name) errors.push("current opponent regression");
  if (!candidate.lastGame.opponent || candidate.lastGame.finalScore.rutgers == null || candidate.lastGame.finalScore.opponent == null) errors.push("latest game regression");
  if (candidate.opponent.isPlaceholder && (candidate.opponent.dataAvailable || candidate.opponent.roster.length || candidate.opponent.leaders.length || candidate.opponent.injuries.length || candidate.opponent.depthChart.length)) errors.push("FCS fallback populated unavailable data");
  if (candidate.opponent.isPlaceholder && !candidate.opponent.unavailableReason) errors.push("FCS reason missing");
  if (candidate.rutgersInjuries.records.some(row => row.playerJoinStatus !== "joined")) errors.push("injury joins invalid");
  const idSet = new Set(ids);
  for (const group of Object.values(candidate.rutgersTeamLeaders)) for (const leader of group.leaders || []) if (!idSet.has(leader.playerId)) errors.push("leader outside Rutgers roster");
  if (candidate.recruiting.rutgersActiveBoard.status !== "unavailable" || candidate.recruiting.rutgersActiveBoard.ownershipConfidence !== "unresolved") errors.push("active-board uncertainty lost");
  if (errors.length) throw new Error(`Candidate validation failed: ${errors.join("; ")}`);
  return { status: "PASS", errors: [], checks: 10 };
}

function integrationSummary(candidate, validation) {
  const players = candidate.rutgersRoster.players;
  return { schemaVersion: "current_week_integration_summary_v1", validation, counts: { rutgersRoster: players.length, completeRatings: players.filter(row => Object.keys(row.ratings).length === 57).length, playersWithSeasonStats: players.filter(row => row.seasonStatistics).length, playersWithLatestGameStats: players.filter(row => row.latestGameStatistics).length, rutgersInjuries: candidate.rutgersInjuries.count, rutgersInterestPool: candidate.recruiting.rutgersInterestPool.records.length, rutgersActiveBoard: null }, leaders: candidate.rutgersTeamLeaders, teamSeasonStatsAvailable: Boolean(candidate.rutgersTeamStatistics), lastGame: { sourceGameId: candidate.lastGame.sourceGameId, opponent: candidate.lastGame.opponent, finalScore: candidate.lastGame.finalScore, result: candidate.lastGame.result }, recruitingOwnership: candidate.recruiting.ownershipAssessment, fcsFallback: candidate.opponent, safety: { outputDirectory: path.relative(ROOT, OUTPUT_DIR).replaceAll("\\", "/"), productionTouched: false, published: false, committed: false, pushed: false } };
}

function run(options = {}) {
  const source = verifySources();
  const raw = JSON.parse(fs.readFileSync(RAW_PATH, "utf8"));
  const candidate = buildCandidate(raw, source);
  const validation = validateCandidate(candidate);
  if (options.write !== false) {
    const files = { "normalized_current_week.json": candidate, "current_context.json": candidate.currentContext, "rutgers_roster.json": candidate.rutgersRoster, "rutgers_team_stats.json": candidate.rutgersTeamStatistics, "rutgers_player_stats.json": candidate.rutgersPlayerStatistics, "rutgers_team_leaders.json": candidate.rutgersTeamLeaders, "last_game.json": candidate.lastGame, "rutgers_injuries.json": candidate.rutgersInjuries, "recruiting_interest_pool.json": candidate.recruiting.rutgersInterestPool, "recruiting_active_board.json": candidate.recruiting.rutgersActiveBoard, "opponent_availability.json": candidate.opponent, "integration_summary.json": integrationSummary(candidate, validation) };
    for (const [name, value] of Object.entries(files)) writeJson(path.join(OUTPUT_DIR, name), value);
  }
  return { candidate, validation, summary: integrationSummary(candidate, validation) };
}

if (require.main === module) process.stdout.write(`${JSON.stringify(run().summary, null, 2)}\n`);
module.exports = { OUTPUT_DIR, RAW_PATH, SCHEMA_PATH, STALE_OPPONENTS, buildCandidate, calculateLeaders, dynastyContext, normalizeRecruiting, opponentAvailability, run, validateCandidate, verifySources };
