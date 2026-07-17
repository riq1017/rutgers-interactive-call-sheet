#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_PARSER = path.join(REPO_ROOT, "tools", "cfb27_save_reader", "runtime", "cfb-dynasty.exe");
const DEFAULT_SCHEMA_DIR = path.join(REPO_ROOT, "tools", "cfb27_save_reader", "runtime", "schemas");
const DEFAULT_RUN_ROOT = path.join(REPO_ROOT, "data", "generated", "dynasty", "refresh_runs");
const SAVE_A_SHA256 = "0fff0ebf2738dbac0d71564189f3f3e2ebd5efae3a71fd24d93e1632fb469e22";

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--") || i + 1 >= argv.length) throw new Error(`Expected --name value, received ${key}`);
    result[key.slice(2)] = argv[++i];
  }
  if (!result["save-a"] && !result["save-b"]) throw new Error("A save must be explicitly selected with --save-a <path> or --save-b <path>.");
  if (result["save-a"] && result["save-b"]) throw new Error("Select exactly one save.");
  return result;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

function uniqueRunDirectory(root) {
  fs.mkdirSync(root, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const id = `${timestamp}_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
    const dir = path.join(root, id);
    try { fs.mkdirSync(dir); return { id, dir }; }
    catch (error) { if (error.code !== "EEXIST") throw error; }
  }
  throw new Error("Unable to allocate a unique refresh run directory.");
}

function lineage(label, packageId, sourceHash, snapshotPath) {
  return { package_id: packageId, save_selection: label, save_sha256: sourceHash, snapshot_path: snapshotPath };
}

function normalize(raw, packageId, sourceHash, snapshotPath, label = "Save A") {
  const team = (raw.teams || []).find(item => String(item.displayName || item.longName || "").toLowerCase() === "rutgers");
  if (!team) throw new Error("Parser export does not contain Rutgers.");
  const games = (raw.games || []).filter(game => game.homeTeam === "Rutgers" || game.awayTeam === "Rutgers");
  const currentWeek = Number(raw.season && raw.season.week);
  const isComplete = game => /^(played|.*won|.*lost)$/i.test(String(game.status || ""));
  const upcoming = games.find(game => Number(game.week) === currentWeek && !isComplete(game)) ||
    games.filter(game => !isComplete(game)).sort((a, b) => Number(a.week) - Number(b.week))[0];
  if (!upcoming) throw new Error("Parser export does not contain an upcoming Rutgers opponent.");
  const opponent = upcoming.homeTeam === "Rutgers" ? upcoming.awayTeam : upcoming.homeTeam;
  const location = upcoming.homeTeam === "Rutgers" ? "Home" : "Away";
  const opponentTeam = (raw.teams || []).find(item => String(item.displayName || item.longName || "") === opponent);
  const rutgersRoster = (raw.rosters || []).find(item => String(item.teamId) === String(team.id));
  const opponentRoster = opponentTeam && (raw.rosters || []).find(item => String(item.teamId) === String(opponentTeam.id));
  const record = `${Number(team.overallWins || 0)}-${Number(team.overallLosses || 0)}`;
  const opponentPlayers = ((opponentRoster && opponentRoster.players) || []).map(player => ({
    player_id: String(player.id), name: [player.firstName, player.lastName].filter(Boolean).join(" "), position: player.position || null,
    jersey: player.jersey ?? null, overall: player.overall ?? null
  }));
  return {
    schema_version: "dynasty_preview_v2", package_type: "normalized_dynasty_preview",
    lineage: lineage(label, packageId, sourceHash, snapshotPath),
    team: { id: team.id, name: team.displayName || team.longName, record },
    season: raw.season && raw.season.year != null ? raw.season.year : null,
    week: upcoming.week != null ? Number(upcoming.week) : null,
    opponent: { id: opponentTeam ? opponentTeam.id : null, name: opponent, player_count: opponentPlayers.length, players: opponentPlayers },
    location, game_status: upcoming.status || null,
    rutgers_player_count: rutgersRoster && Array.isArray(rutgersRoster.players) ? rutgersRoster.players.length : null,
    schedule: { current_game_id: upcoming.id, next_games: games.filter(game => Number(game.week) >= Number(upcoming.week)).map(game => ({ id: game.id, week: Number(game.week), opponent: game.homeTeam === "Rutgers" ? game.awayTeam : game.homeTeam, location: game.homeTeam === "Rutgers" ? "Home" : "Away", status: game.status })) },
    availability: { tactical_recommendations: "unavailable_from_parser_export", recruiting: "unavailable_from_parser_export", awards: "unavailable_from_parser_export" },
    provenance: {
      directly_parsed: ["team.name", "season", "week", "opponent.name", "game_status", "team wins/losses", "schedule", "rosters"],
      calculated: ["team.record", "location", "opponent.player_count"],
      unavailable: ["tactical_recommendations", "recruiting", "awards"]
    }
  };
}

function bridgeScript(normalized, packageId) {
  const payload = { package_id: packageId, team: normalized.team.name, season: normalized.season, week: normalized.week, record: normalized.team.record, opponent: normalized.opponent.name, opponent_id: normalized.opponent.id, location: normalized.location };
  const safe = JSON.stringify(payload).replace(/</g, "\\u003c");
  const opponentPlayers = JSON.stringify(normalized.opponent.players).replace(/</g, "\\u003c");
  return `"use strict";\n(function(){\nconst p=${safe};\nconst opponentPlayers=${opponentPlayers};\nconst permanentPlayIds=(window.RUTGERS_PLAYBOOK||[]).slice(0,12).map(x=>x.id);\nif(permanentPlayIds.length!==12)throw new Error("Real-shell preview requires 12 permanent playbook IDs for runtime schema compatibility");\nwindow.WEEKLY_PLAN={schema_version:"dynasty_preview_v2",package_id:p.package_id,source_of_truth:"dynasty_save",gameday:{title:"Gameday Gameplan",currentWeek:"Week "+p.week,seasonRecord:p.record,rutgersRank:"N/A",offenseRank:null,defenseRank:null,momentumStatus:"Save preview",lastUpdated:"Immutable run preview"},opponent:{name:p.opponent,team_id:p.opponent_id,record:"",week:"Week "+p.week,location:p.location,game_status:"Unplayed"},openingScript:permanentPlayIds,familyModifiers:{},modifierCaps:{},riskRules:{},traits:[],warnings:["Tactical recommendations unavailable from parser export"],players:{},tactical_recommendations:{status:"unavailable_from_parser_export",recommendations:[]}};\nwindow.GAMEPLAN_WEEKLY={schema_version:"dynasty_save_preview_v2",package_type:"gameplan_weekly_update",package_id:p.package_id,source_of_truth:"dynasty_save",team_name:p.team,season:p.season,week:p.week,rutgers_record:p.record,opponent:p.opponent,location:p.location,opponent_profile:{team:p.opponent,name:p.opponent,team_id:p.opponent_id,record:"",verification_status:"save-derived"},opponent_players:opponentPlayers,opponent_position_groups:[],quick_tactical_summary:{status:"unavailable_from_parser_export",avoid:[],recommendations:[]},usage_plan:{status:"unavailable_from_parser_export"},matchups:[],run_direction:[],protection:[],last_game:{},season_stats:{},opponent_season_stats:{}};\nwindow.RUTGERS_ROSTER_BASE=Object.assign({},window.RUTGERS_ROSTER_BASE||{players:[],position_groups:[]},{package_id:p.package_id,source_truth:"dynasty_save",team:Object.assign({},(window.RUTGERS_ROSTER_BASE||{}).team||{},{name:p.team,record:p.record})});\nwindow.OPPONENT_DATA={package_id:p.package_id,team:p.opponent,players:opponentPlayers};\nwindow.OPPONENT_LAST_GAME_STATS={};window.OPPONENT_SEASON_STATS={};window.PLAYER_MATCHUPS={matchups:[]};window.PURDUE_MATCHUPS={matchups:[]};window.PURDUE_OPPONENT_PLAYERS=[];window.PURDUE_OPPONENT_POSITION_GROUPS=[];window.PURDUE_OPPONENT_PROFILE={};window.VIDEO_VERIFIED_PURDUE_ROSTER={players:[]};window.VIDEO_VERIFIED_PURDUE_ROSTER_RECOVERY={players:[]};window.VIDEO_VERIFIED_PURDUE_SEASON_STATS={};window.WEEKLY_COACHING_DECISIONS={status:"unavailable_from_parser_export"};window.WEEKLY_RUN_LANE_ANALYSIS={status:"unavailable_from_parser_export"};window.WEEKLY_MATCHUP_SUMMARY={status:"unavailable_from_parser_export"};\ndocument.documentElement.dataset.packageId=p.package_id;document.documentElement.dataset.previewSource="real-application-shell";document.documentElement.dataset.season=String(p.season);document.documentElement.dataset.week=String(p.week);document.documentElement.dataset.team=p.team;document.documentElement.dataset.opponent=p.opponent;document.documentElement.dataset.location=p.location;document.documentElement.dataset.record=p.record;\naddEventListener("DOMContentLoaded",()=>{const shownWeek=(document.getElementById("weekOpponent")||{}).textContent||"";const shownRecord=(document.getElementById("seasonRecord")||{}).textContent||"";document.documentElement.dataset.domProof=(shownWeek.includes("Week "+p.week)&&shownWeek.includes(p.opponent)&&shownRecord===p.record)?"PASS":"FAIL";});\n})();\n`;
}

function realShellPreview(runDir, normalized, packageId) {
  const dir = path.join(runDir, "preview", "real-shell");
  fs.mkdirSync(dir, { recursive: true });
  const relativeRoot = path.relative(dir, REPO_ROOT).replace(/\\/g, "/") + "/";
  let html = fs.readFileSync(path.join(REPO_ROOT, "index.html"), "utf8");
  html = html.replace("<head>", `<head>\n<base href="${relativeRoot}">`);
  html = html.replace(/<script src="app\.js[^\"]*"><\/script>/, `<script src="${relativeRoot}data/generated/dynasty/refresh_runs/${path.basename(runDir)}/preview/real-shell/save-preview-bridge.js"></script>\n<script src="app.js?preview=${packageId}"></script>`);
  const indexPath = path.join(dir, "index.html");
  fs.writeFileSync(indexPath, html, { encoding: "utf8", flag: "wx" });
  const bridgePath = path.join(dir, "save-preview-bridge.js");
  fs.writeFileSync(bridgePath, bridgeScript(normalized, packageId), { encoding: "utf8", flag: "wx" });
  writeJson(path.join(dir, "browser-proof-expectation.json"), { package_id: packageId, runtime: "repository index.html + repository app.js", expected_dom: { weekOpponent: `Week ${normalized.week} vs ${normalized.opponent.name}`, seasonRecord: normalized.team.record }, context: { team: normalized.team.name, season: normalized.season, week: normalized.week, opponent: normalized.opponent.name, location: normalized.location } });
  return { index: indexPath, bridge: bridgePath, expectation: path.join(dir, "browser-proof-expectation.json"), repository_app_js_sha256: sha256(path.join(REPO_ROOT, "app.js")), repository_index_sha256: sha256(path.join(REPO_ROOT, "index.html")) };
}

function run(options) {
  const label = options && options["save-b"] ? "Save B" : "Save A";
  const selected = options && (options["save-b"] || options["save-a"]);
  if (!selected) throw new Error("A save must be explicitly selected.");
  const save = path.resolve(selected), parser = path.resolve(options.parser || DEFAULT_PARSER), schemaDir = path.resolve(options["schema-dir"] || DEFAULT_SCHEMA_DIR), runRoot = path.resolve(options["run-root"] || DEFAULT_RUN_ROOT);
  if (!fs.statSync(save).isFile()) throw new Error(`${label} is not a file: ${save}`);
  if (!fs.statSync(parser).isFile()) throw new Error(`Parser is not a file: ${parser}`);
  const { id: runId, dir: runDir } = uniqueRunDirectory(runRoot);
  const manifestPath = path.join(runDir, "refresh-manifest.json");
  const manifest = { schema_version: "dynasty_refresh_manifest_v2", run_id: runId, status: "FAIL", save_selection: { label, path: save, explicit: true }, production_write_attempted: false, production_changed: false, checks: [] };
  try {
    const sourceBefore = sha256(save);
    if (label === "Save B" && sourceBefore === SAVE_A_SHA256) throw new Error("Save B hash must differ from Save A.");
    const snapshotDir = path.join(runDir, "snapshot"); fs.mkdirSync(snapshotDir);
    const snapshotPath = path.join(snapshotDir, path.basename(save)); fs.copyFileSync(save, snapshotPath, fs.constants.COPYFILE_EXCL);
    const sourceAfter = sha256(save), snapshotHash = sha256(snapshotPath);
    Object.assign(manifest, { source_sha256_before: sourceBefore, source_sha256_after: sourceAfter, snapshot_sha256: snapshotHash, snapshot_path: snapshotPath });
    if (!(sourceBefore === sourceAfter && sourceAfter === snapshotHash)) throw new Error("Source-before, source-after, and snapshot hashes do not match.");
    manifest.checks.push({ name: "snapshot_hash_match", status: "PASS" });
    if (label === "Save B") manifest.checks.push({ name: "save_b_differs_from_save_a", status: "PASS" });
    const rawDir = path.join(runDir, "raw"); fs.mkdirSync(rawDir); const rawExport = path.join(rawDir, "parser-export.json");
    const parserArgs = ["export", "-schema-dir", schemaDir, "-season", "-teams", "-rosters", "-games", "-season-stats", "-injuries", "-depth-charts", "-o", rawExport, snapshotPath];
    manifest.parser = { executable: parser, executable_sha256: sha256(parser), args: parserArgs, input_path: snapshotPath, live_save_used: false };
    const parsed = spawnSync(parser, parserArgs, { encoding: "utf8", windowsHide: true, shell: /\.(cmd|bat)$/i.test(parser) });
    manifest.parser.returncode = parsed.status;
    if (parsed.status !== 0) throw new Error(`External parser failed: ${(parsed.stderr || parsed.stdout || "no output").trim()}`);
    if (!fs.existsSync(rawExport)) throw new Error("External parser did not create its export.");
    manifest.checks.push({ name: "parser_snapshot_only", status: "PASS" });
    const prefix = label === "Save B" ? "save-b" : "save-a";
    const packageId = `${prefix}-${sourceBefore.slice(0, 12)}-${runId}`;
    const normalized = normalize(JSON.parse(fs.readFileSync(rawExport, "utf8")), packageId, sourceBefore, snapshotPath, label);
    if (label === "Save B" && !(normalized.season === 2026 && normalized.week === 2 && normalized.team.record === "1-0" && normalized.opponent.name === "Boston College" && normalized.location === "Away")) throw new Error("Save B parsed context does not match the approved Week 2 Boston College away-game expectations.");
    const normalizedPath = path.join(runDir, "normalized", "dynasty.json"); writeJson(normalizedPath, normalized);
    const staging = { schema_version: "dynasty_staging_v2", package_id: packageId, lineage: lineage(label, packageId, sourceBefore, snapshotPath), team: normalized.team.name, season: normalized.season, week: normalized.week, record: normalized.team.record, opponent: normalized.opponent, location: normalized.location, tactical_recommendations: { status: "unavailable_from_parser_export", recommendations: [] } };
    const stagingPath = path.join(runDir, "staging", "package.json"); writeJson(stagingPath, staging);
    const previewData = { schema_version: "dynasty_browser_preview_v2", package_id: packageId, lineage: lineage(label, packageId, sourceBefore, snapshotPath), team: staging.team, season: staging.season, week: staging.week, record: staging.record, opponent: staging.opponent.name, location: staging.location, tactical_recommendations: staging.tactical_recommendations };
    const previewDataPath = path.join(runDir, "preview", "data", "package.json"); writeJson(previewDataPath, previewData);
    const realShell = realShellPreview(runDir, normalized, packageId);
    Object.assign(manifest, { package_id: packageId, artifacts: { raw: rawExport, normalized: normalizedPath, staging: stagingPath, preview_data: previewDataPath, real_shell: realShell }, browser_expectation: { package_id: packageId, runtime: "real_repository_application_shell", team: previewData.team, season: previewData.season, week: previewData.week, record: previewData.record, opponent: previewData.opponent, location: previewData.location } });
    manifest.checks.push({ name: "single_package_id", status: "PASS" }, { name: "save_hash_lineage", status: "PASS" }, { name: "unsupported_tactics_unavailable", status: "PASS" }, { name: "real_application_shell_generated", status: "PASS" });
    manifest.status = "PASS"; writeJson(manifestPath, manifest); return { manifestPath, manifest };
  } catch (error) { manifest.failure = error.message; writeJson(manifestPath, manifest); error.manifestPath = manifestPath; throw error; }
}

if (require.main === module) {
  try { const result = run(parseArgs(process.argv.slice(2))); process.stdout.write(`${JSON.stringify({ status: "PASS", manifest: result.manifestPath, ...result.manifest.browser_expectation }, null, 2)}\n`); }
  catch (error) { process.stderr.write(`${JSON.stringify({ status: "FAIL", reason: error.message, manifest: error.manifestPath || null }, null, 2)}\n`); process.exitCode = 1; }
}

module.exports = { SAVE_A_SHA256, bridgeScript, normalize, parseArgs, realShellPreview, run, sha256 };
