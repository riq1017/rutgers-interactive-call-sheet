#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const vm = require("vm");
const { buildCandidate: buildCurrentWeekCandidate, validateCandidate: validateCurrentWeekCandidate } = require("./current_week_normalizer");
const { adaptNormalizedCandidate } = require("./current_week_ui_adapter");

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
  const selections = ["save", "save-a", "save-b"].filter(key => result[key]);
  if (selections.length !== 1) throw new Error("Select exactly one save with --save <path>.");
  return result;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function wrapperScript(declaration) {
  const encoded = stableJson(declaration).replace(/</g, "\\u003c");
  return `"use strict";\n(function(root){\nroot.ACTIVE_PACKAGE_ARTIFACTS=root.ACTIVE_PACKAGE_ARTIFACTS||Object.create(null);\nif(root.ACTIVE_PACKAGE_ARTIFACTS[${JSON.stringify(declaration.artifact)}])throw new Error("Duplicate active-package artifact: ${declaration.artifact}");\nroot.ACTIVE_PACKAGE_ARTIFACTS[${JSON.stringify(declaration.artifact)}]=Object.freeze(${encoded});\n${declaration.artifact === "weekly_manifest" ? `root.ACTIVE_PACKAGE_MANIFEST=Object.freeze(${stableJson(declaration.payload).replace(/</g, "\\u003c")});\n` : ""}})(globalThis);\n`;
}

function generateActivePackageArtifacts(runDir, normalized, packageId, refreshId, sourceHash, normalizedHash, currentWeekUi = null) {
  const dir = path.join(runDir, "preview", "real-shell", "active-package", packageId);
  fs.mkdirSync(dir, { recursive: true });
  const context = { team_id: normalized.team.id, season: normalized.season, week: normalized.week, opponent_id: normalized.opponent.id, opponent_name: normalized.opponent.name };
  const definitions = {
    weekly_plan: { required: true, status: "available", payload: { team: normalized.team, season: normalized.season, week: normalized.week, opponent: normalized.opponent.name, opponent_id: normalized.opponent.id, location: normalized.location } },
    gameplan_weekly: { required: true, status: "available", payload: { team_name: normalized.team.name, team_id: normalized.team.id, season: normalized.season, week: normalized.week, record: normalized.team.record, opponent: normalized.opponent.name, opponent_id: normalized.opponent.id, location: normalized.location } },
    rutgers_roster: { required: true, status: "available", payload: { team: normalized.team, player_count: normalized.rutgers_player_count, players: normalized.rutgers_players } },
    current_opponent: { required: true, status: "available", payload: normalized.opponent },
    statistics: { required: false, status: "unavailable", payload: null },
    injuries: { required: false, status: "unavailable", payload: null },
    matchups: { required: false, status: "unavailable", payload: null },
    recruiting: { required: false, status: "unavailable", payload: null },
    recovery: { required: false, status: "unavailable", payload: null },
    current_week_ui: { required: false, status: currentWeekUi ? "available" : "unavailable", payload: currentWeekUi }
  };
  const manifestPayload = { schema_version: "cfb27_weekly_manifest_v1", package_id: packageId, refresh_id: refreshId, ...context, domains: Object.fromEntries(Object.entries(definitions).map(([key, value]) => [key, { required: value.required, status: value.status }])) };
  const all = { weekly_manifest: { required: true, status: "available", payload: manifestPayload }, ...definitions };
  const paths = {}, artifactMap = {};
  for (const [artifact, definition] of Object.entries(all)) {
    const declaration = { schema_version: "cfb27_artifact_declaration_v1", artifact, package_id: packageId, refresh_id: refreshId, ...context, status: definition.status, payload: definition.payload };
    const text = wrapperScript(declaration);
    const file = path.join(dir, `${artifact}.js`);
    fs.writeFileSync(file, text, { encoding: "utf8", flag: "wx" });
    paths[artifact] = file;
    artifactMap[artifact] = { sha256: sha256Text(text), required: definition.required, status: definition.status };
  }
  const marker = { schema_version: "cfb27_active_package_v1", package_id: packageId, refresh_id: refreshId, source_sha256: sourceHash, snapshot_sha256: sourceHash, normalized_sha256: normalizedHash, ...context, artifacts: artifactMap };
  const markerText = `"use strict";\nglobalThis.ACTIVE_DYNASTY_PACKAGE=Object.freeze(${stableJson(marker).replace(/</g, "\\u003c")});\n`;
  const markerPath = path.join(dir, "active_package.js");
  fs.writeFileSync(markerPath, markerText, { encoding: "utf8", flag: "wx" });
  return { directory: dir, marker: markerPath, wrappers: paths, marker_payload: marker };
}

function generateRutgersMediaWrapper(runDir) {
  const sourcePath = path.join(REPO_ROOT, "data", "player_media.js");
  const scope = { window: {} };
  vm.runInNewContext(fs.readFileSync(sourcePath, "utf8"), scope, { filename: sourcePath });
  const source = scope.window.RUTGERS_PLAYER_MEDIA;
  if (!source || source.team !== "Rutgers" || source.package_type !== "rutgers_player_media" || !Array.isArray(source.players) || !source.players.length) throw new Error("Rutgers media allowlist source is invalid.");
  const allowedFields = ["player_id", "portrait_path", "media_type", "framing", "uniform", "background", "source_status"];
  const players = source.players.map(entry => {
    if (!entry.player_id || !/^assets\/player-portraits\/rutgers\/[a-z0-9-]+\.svg$/i.test(String(entry.portrait_path || ""))) throw new Error(`Rejected non-Rutgers media entry: ${entry.player_id || "unknown"}`);
    if (String(entry.uniform || "") !== "Rutgers scarlet") throw new Error(`Rejected non-Rutgers uniform media entry: ${entry.player_id}`);
    return Object.fromEntries(allowedFields.filter(field => entry[field] !== undefined).map(field => [field, entry[field]]));
  });
  const payload = { schema_version: "cfb27_rutgers_media_allowlist_v1", package_type: "rutgers_player_media", team: "Rutgers", source_status: "run_local_explicit_rutgers_allowlist", players };
  const text = `"use strict";\nglobalThis.RUTGERS_PLAYER_MEDIA=Object.freeze(${stableJson(payload).replace(/</g, "\\u003c")});\n`;
  if (/OPPONENT_PLAYER_MEDIA|PLAYER_CARD_REGISTRY|purdue|umass|boston college|player-portraits\/opponent/i.test(text)) throw new Error("Opponent media survived Rutgers-only wrapper generation.");
  const file = path.join(runDir, "preview", "real-shell", "rutgers_media.js");
  fs.writeFileSync(file, text, { encoding: "utf8", flag: "wx" });
  return { file, sha256: sha256Text(text), player_count: players.length, source_sha256: sha256(sourcePath) };
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

function opponentIdentity(opponentName, opponentTeam) {
  if (opponentTeam && opponentTeam.id !== undefined && opponentTeam.id !== null && opponentTeam.id !== "") return opponentTeam.id;
  if (/^FCS(?:\s|$)/i.test(String(opponentName || ""))) {
    const slug = String(opponentName).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (slug) return `fcs:${slug}`;
  }
  throw new Error(`Parser export does not contain an identity for upcoming opponent ${opponentName}.`);
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
  const opponentId = opponentIdentity(opponent, opponentTeam);
  const rutgersRoster = (raw.rosters || []).find(item => String(item.teamId) === String(team.id));
  const opponentRoster = opponentTeam && (raw.rosters || []).find(item => String(item.teamId) === String(opponentTeam.id));
  const record = `${Number(team.overallWins || 0)}-${Number(team.overallLosses || 0)}`;
  const opponentPlayers = ((opponentRoster && opponentRoster.players) || []).map(player => ({
    player_id: String(player.id), name: [player.firstName, player.lastName].filter(Boolean).join(" "), position: player.position || null,
    jersey: player.jersey ?? null, overall: player.overall ?? null
  }));
  const rutgersPlayers = ((rutgersRoster && rutgersRoster.players) || []).map(player => ({
    player_id: String(player.id), id: String(player.id), name: [player.firstName, player.lastName].filter(Boolean).join(" "),
    full_name: [player.firstName, player.lastName].filter(Boolean).join(" "), display_name: [player.firstName, player.lastName].filter(Boolean).join(" "),
    position: player.position || null, jersey: player.jersey ?? null, jersey_number: player.jersey ?? null, overall: player.overall ?? null,
    attributes: player.attributes || {}
  }));
  return {
    schema_version: "dynasty_preview_v2", package_type: "normalized_dynasty_preview",
    lineage: lineage(label, packageId, sourceHash, snapshotPath),
    team: { id: team.id, name: team.displayName || team.longName, record },
    season: raw.season && raw.season.year != null ? raw.season.year : null,
    week: upcoming.week != null ? Number(upcoming.week) : null,
    opponent: { id: opponentId, name: opponent, player_count: opponentPlayers.length, players: opponentPlayers },
    location, game_status: upcoming.status || null,
    rutgers_player_count: rutgersRoster && Array.isArray(rutgersRoster.players) ? rutgersRoster.players.length : null,
    rutgers_players: rutgersPlayers,
    schedule: { current_game_id: upcoming.id, next_games: games.filter(game => Number(game.week) >= Number(upcoming.week)).map(game => ({ id: game.id, week: Number(game.week), opponent: game.homeTeam === "Rutgers" ? game.awayTeam : game.homeTeam, location: game.homeTeam === "Rutgers" ? "Home" : "Away", status: game.status })) },
    availability: { tactical_recommendations: "unavailable_from_parser_export", recruiting: "unavailable_from_parser_export", awards: "unavailable_from_parser_export" },
    provenance: {
      directly_parsed: ["team.name", "season", "week", "opponent.name", "game_status", "team wins/losses", "schedule", "rosters"],
      calculated: ["team.record", "location", "opponent.player_count"],
      unavailable: ["tactical_recommendations", "recruiting", "awards"]
    }
  };
}

const LEGACY_STARTUP_PATHS = Object.freeze([
  "data/rutgers_team.js", "data/rutgers_playbook.js", "data/weekly_plan.js", "data/game_history.js", "data/recruiting_data.js",
  "data/engine_data.js", "data/depth_chart_seed.js", "data/phase1_verified_data.js", "data/player_media.js", "data/card_registry.js",
  "data/weekly/coaching_decisions.js", "data/weekly/run_lane_analysis.js", "data/weekly/weekly_matchup_summary.js",
  "data/video_verified/rutgers_season_stats.js", "data/video_verified/purdue_season_stats.js", "data/video_verified/purdue_roster.js",
  "data/video_verified/four_star_freshman_class.js", "data/video_verified/rutgers_prospect_board.js", "data/video_verified/rutgers_roster_recovery.js",
  "data/video_verified/purdue_roster_recovery.js", "data/video_verified/rutgers_board_scouting_recovery.js", "data/video_verified/video_evidence_index.js", "app.js"
]);
const CONTROLLED_WRAPPERS = Object.freeze(["weekly_manifest", "weekly_plan", "gameplan_weekly", "rutgers_roster", "current_opponent", "statistics", "injuries", "matchups", "recruiting", "recovery"]);
const CURRENT_CONTROLLED_WRAPPERS = Object.freeze([...CONTROLLED_WRAPPERS, "current_week_ui"]);
function resourceUrl(value) { return new URL(String(value), "https://preview.invalid/"); }
function scriptElements(html) {
  return [...String(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(match => {
    const src = match[1].match(/\bsrc=["']([^"']+)["']/i);
    return { start: match.index, end: match.index + match[0].length, source: src ? src[1] : null, body: match[2] };
  });
}
function assertContiguous(html, scripts, first, last) {
  for (let index = first; index < last; index += 1) if (!/^\s*$/.test(html.slice(scripts[index].end, scripts[index + 1].start))) throw new Error("Startup block is not contiguous.");
  const bodyAt = html.indexOf("</body>", scripts[last].end);
  if (bodyAt < 0 || !/^\s*$/.test(html.slice(scripts[last].end, bodyAt))) throw new Error("Unexpected content follows the startup block.");
}
function validateLegacyBlock(html, scripts, first) {
  const last = first + LEGACY_STARTUP_PATHS.length - 1;
  if (last >= scripts.length) throw new Error("Legacy startup block is incomplete.");
  const actual = scripts.slice(first, last + 1).map(script => script.source && resourceUrl(script.source).pathname.replace(/^\//, ""));
  if (actual.some((value, index) => value !== LEGACY_STARTUP_PATHS[index])) throw new Error("Legacy startup block contains an unexpected script.");
  assertContiguous(html, scripts, first, last);
  return { first, last };
}
function validateControlledBlock(html, scripts, first) {
  const declaration = scripts[first];
  if (declaration.source || !/globalThis\.CFB27_APP_STARTUP_MODE\s*=\s*["']controlled["']/.test(declaration.body) || !/globalThis\.CFB27_DEPLOYMENT_RELEASE_ID\s*=/.test(declaration.body)) throw new Error("Controlled startup declaration is incomplete.");
  let selected = null;
  for (const wrappers of [CURRENT_CONTROLLED_WRAPPERS, CONTROLLED_WRAPPERS]) {
    const last = first + wrappers.length + 6;
    if (last >= scripts.length) continue;
    const resources = scripts.slice(first + 1, last + 1);
    if (resources.some(script => !script.source)) continue;
    const urls = resources.map(script => resourceUrl(script.source));
    const paths = urls.map(url => url.pathname.replace(/^\//, ""));
    const packageMatch = paths[0].match(/^data\/active-packages\/([^/]+)\/active_package\.js$/);
    if (!packageMatch) continue;
    const prefix = `data/active-packages/${packageMatch[1]}`;
    const expected = [`${prefix}/active_package.js`, ...wrappers.map(name => `${prefix}/${name}.js`), "data/rutgers_playbook.js", "data/rutgers_media.js", "package_runtime.js", "app.js", "production_startup.js"];
    if (paths.every((value, index) => value === expected[index])) { selected = { last, urls, packageMatch }; break; }
  }
  if (!selected) throw new Error("Controlled startup block is incomplete or contains an unexpected script.");
  const { last, urls, packageMatch } = selected;
  const releaseIds = new Set();
  for (const url of urls) {
    const values = url.searchParams.getAll("r");
    if (values.length !== 1 || !values[0]) throw new Error("Controlled startup resource has an invalid release token.");
    releaseIds.add(values[0]);
  }
  if (releaseIds.size !== 1) throw new Error("Controlled startup resources use mixed release tokens.");
  assertContiguous(html, scripts, first, last);
  return { first, last, package_id: packageMatch[1], release_id: [...releaseIds][0] };
}
function replaceStartupBlock(htmlInput, replacement) {
  const html = String(htmlInput), scripts = scriptElements(html);
  const legacy = scripts.map((script, index) => script.source && resourceUrl(script.source).pathname === "/data/rutgers_team.js" ? index : -1).filter(index => index >= 0);
  const controlled = scripts.map((script, index) => !script.source && /globalThis\.CFB27_APP_STARTUP_MODE\s*=\s*["']controlled["']/.test(script.body) ? index : -1).filter(index => index >= 0);
  const candidateCount = legacy.length + controlled.length;
  if (candidateCount !== 1) throw new Error(candidateCount ? "Multiple supported startup blocks found." : "No supported startup block found.");
  const block = legacy.length ? validateLegacyBlock(html, scripts, legacy[0]) : validateControlledBlock(html, scripts, controlled[0]);
  return { html: `${html.slice(0, scripts[block.first].start)}${replacement}${html.slice(scripts[block.last].end)}`, type: legacy.length ? "legacy" : "controlled", production_package_id: block.package_id || null, production_release_id: block.release_id || null };
}

function realShellPreview(runDir, normalized, packageId, activePackage, sourceHtml, currentWeekUi = null) {
  const dir = path.join(runDir, "preview", "real-shell");
  fs.mkdirSync(dir, { recursive: true });
  const relativeRoot = path.relative(dir, REPO_ROOT).replace(/\\/g, "/") + "/";
  const runWebPath = `data/generated/dynasty/refresh_runs/${path.basename(runDir)}/preview/real-shell`;
  const startupPath = path.join(dir, "package_startup.js");
  fs.writeFileSync(startupPath, `"use strict";\n(function(root){\nconst runtime=root.CFB27_PACKAGE_RUNTIME;\nroot.CFB27_ACTIVE_PACKAGE_STARTUP_ORDER=[];\nconst validation=runtime.validateActivePackage(root);\nroot.CFB27_ACTIVE_PACKAGE_VALIDATION=validation;\nroot.CFB27_ACTIVE_PACKAGE_STARTUP_ORDER.push(validation.ok?"VALIDATED":"VALIDATION_FAILED");\nif(!validation.ok){runtime.renderPackageValidationError(validation);return;}\nconst installation=runtime.installActivePackageCompatibilityGlobals(validation,root);\nroot.CFB27_ACTIVE_PACKAGE_INSTALLATION=installation;\nroot.CFB27_ACTIVE_PACKAGE_STARTUP_ORDER.push(installation.status);\nif(!installation.ok){runtime.renderPackageValidationError({error_code:installation.error_code||installation.status,package_id:installation.package_id,refresh_id:installation.refresh_id});return;}\nif(typeof root.CFB27_APP_BOOT!=="function"){runtime.renderPackageValidationError({error_code:"APP_BOOT_UNAVAILABLE",package_id:validation.package_id,refresh_id:validation.refresh_id});return;}\nroot.CFB27_APP_BOOT_RESULT=root.CFB27_APP_BOOT({startupApproved:true});\nroot.CFB27_ACTIVE_PACKAGE_STARTUP_ORDER.push(root.CFB27_APP_BOOT_RESULT);\nif(root.CFB27_APP_BOOT_RESULT!=="BOOTED"){runtime.renderPackageValidationError({error_code:"APP_BOOT_FAILED",package_id:validation.package_id,refresh_id:validation.refresh_id});return;}\nroot.document.documentElement.dataset.domProof=(root.document.getElementById("weekOpponent")?.textContent||"").includes("Week ${normalized.week} vs ${normalized.opponent.name}")&&(root.document.getElementById("seasonRecord")?.textContent||"")==="${normalized.team.record}"?"PASS":"FAIL";\n})(globalThis);\n`, { encoding: "utf8", flag: "wx" });
  let html = sourceHtml === undefined ? fs.readFileSync(path.join(REPO_ROOT, "index.html"), "utf8") : String(sourceHtml);
  html = html.replace("<head>", `<head>\n<base href="${relativeRoot}">`);
  const wrapperOrder = CURRENT_CONTROLLED_WRAPPERS;
  const media = generateRutgersMediaWrapper(runDir);
  const scriptSources = [
    `${runWebPath}/active-package/${packageId}/active_package.js`,
    ...wrapperOrder.map(name => `${runWebPath}/active-package/${packageId}/${name}.js`),
    "data/rutgers_playbook.js",
    `${runWebPath}/rutgers_media.js`,
    "package_runtime.js",
    "app.js",
    `${runWebPath}/package_startup.js`
  ];
  const scripts = scriptSources.map(src => `<script src="${src}"></script>`).join("\n");
  const replaced = replaceStartupBlock(html, `<script>globalThis.CFB27_APP_STARTUP_MODE="controlled";</script>\n${scripts}`);
  html = replaced.html;
  if (html.includes("save-preview-bridge.js") || html.includes("data/weekly_plan.js") || html.includes("data/player_media.js")) throw new Error("Legacy preview scripts survived direct-package shell generation.");
  if (html.includes("data/active-packages/")) throw new Error("Production active-package scripts survived direct-package shell generation.");
  const indexPath = path.join(dir, "index.html");
  fs.writeFileSync(indexPath, html, { encoding: "utf8", flag: "wx" });
  const sourceExpectations = currentWeekUi ? { leaders: Object.values(currentWeekUi.team_leaders || {}).flatMap(group => group.leaders || []).map(row => ({ name: row.displayName, value: row.value, stat: row.stat })), roster_count: currentWeekUi.roster.count, injury_count: currentWeekUi.injuries.count, last_game: { source_id: currentWeekUi.last_game.sourceGameId, opponent: currentWeekUi.last_game.opponent, rutgers: currentWeekUi.last_game.rutgersScore, opponent_score: currentWeekUi.last_game.opponentScore }, recruiting: { available: currentWeekUi.recruiting.available, count: currentWeekUi.recruiting.interest_pool.records.length, label: currentWeekUi.recruiting.label, reason: currentWeekUi.recruiting.reason } } : {};
  writeJson(path.join(dir, "browser-proof-expectation.json"), { package_id: packageId, refresh_id: activePackage.marker_payload.refresh_id, runtime: "direct active package + repository app.js", expected_dom: { weekOpponent: `Week ${normalized.week} vs ${normalized.opponent.name}`, seasonRecord: normalized.team.record }, context: { team: normalized.team.name, season: normalized.season, week: normalized.week, record: normalized.team.record, opponent: normalized.opponent.name, location: normalized.location }, current_week: sourceExpectations, script_order: scriptSources });
  return { index: indexPath, startup: startupPath, media, expectation: path.join(dir, "browser-proof-expectation.json"), script_order: scriptSources, repository_app_js_sha256: sha256(path.join(REPO_ROOT, "app.js")), repository_index_sha256: sha256(path.join(REPO_ROOT, "index.html")), active_package: activePackage.directory, replaced_startup_type: replaced.type, replaced_production_package_id: replaced.production_package_id };
}

function run(options) {
  const legacySelection = options && (options["save-b"] ? "Save B" : options["save-a"] ? "Save A" : null);
  const label = String((options && options.label) || legacySelection || "Configured Dynasty Save");
  const selected = options && (options.save || options["save-b"] || options["save-a"]);
  if (!selected) throw new Error("A save must be explicitly selected.");
  const save = path.resolve(selected), parser = path.resolve(options.parser || DEFAULT_PARSER), schemaDir = path.resolve(options["schema-dir"] || DEFAULT_SCHEMA_DIR), runRoot = path.resolve(options["run-root"] || DEFAULT_RUN_ROOT);
  if (!fs.statSync(save).isFile()) throw new Error(`${label} is not a file: ${save}`);
  if (!fs.statSync(parser).isFile()) throw new Error(`Parser is not a file: ${parser}`);
  const { id: runId, dir: runDir } = uniqueRunDirectory(runRoot);
  const manifestPath = path.join(runDir, "refresh-manifest.json");
  const manifest = { schema_version: "dynasty_refresh_manifest_v2", run_id: runId, status: "FAIL", save_selection: { label, path: save, explicit: true }, production_write_attempted: false, production_changed: false, checks: [] };
  try {
    const sourceBefore = sha256(save);
    if (legacySelection === "Save B" && sourceBefore === SAVE_A_SHA256) throw new Error("Save B hash must differ from Save A.");
    const snapshotDir = path.join(runDir, "snapshot"); fs.mkdirSync(snapshotDir);
    const snapshotPath = path.join(snapshotDir, path.basename(save)); fs.copyFileSync(save, snapshotPath, fs.constants.COPYFILE_EXCL);
    const sourceAfter = sha256(save), snapshotHash = sha256(snapshotPath);
    Object.assign(manifest, { source_sha256_before: sourceBefore, source_sha256_after: sourceAfter, snapshot_sha256: snapshotHash, snapshot_path: snapshotPath });
    if (!(sourceBefore === sourceAfter && sourceAfter === snapshotHash)) throw new Error("Source-before, source-after, and snapshot hashes do not match.");
    manifest.checks.push({ name: "snapshot_hash_match", status: "PASS" });
    if (legacySelection === "Save B") manifest.checks.push({ name: "save_b_differs_from_save_a", status: "PASS" });
    const rawDir = path.join(runDir, "raw"); fs.mkdirSync(rawDir); const rawExport = path.join(rawDir, "parser-export.json");
    const parserArgs = ["export", "-schema-dir", schemaDir, "-season", "-teams", "-rosters", "-games", "-season-stats", "-injuries", "-depth-charts", "-o", rawExport, snapshotPath];
    manifest.parser = { executable: parser, executable_sha256: sha256(parser), args: parserArgs, input_path: snapshotPath, live_save_used: false };
    const parsed = spawnSync(parser, parserArgs, { encoding: "utf8", windowsHide: true, shell: /\.(cmd|bat)$/i.test(parser) });
    manifest.parser.returncode = parsed.status;
    if (parsed.status !== 0) throw new Error(`External parser failed: ${(parsed.stderr || parsed.stdout || "no output").trim()}`);
    if (!fs.existsSync(rawExport)) throw new Error("External parser did not create its export.");
    manifest.checks.push({ name: "parser_snapshot_only", status: "PASS" });
    const prefix = legacySelection === "Save B" ? "save-b" : legacySelection === "Save A" ? "save-a" : "dynasty";
    const packageId = `${prefix}-${sourceBefore.slice(0, 12)}-${runId}`;
    const raw = JSON.parse(fs.readFileSync(rawExport, "utf8"));
    const normalized = normalize(raw, packageId, sourceBefore, snapshotPath, label);
    let currentWeekUi = null;
    if (Array.isArray(raw.seasonPlayerStats) && Array.isArray(raw.injuries)) {
      const currentWeek = buildCurrentWeekCandidate(raw, { rawSha256: sha256(rawExport), snapshot: { snapshotSha256: sourceBefore }, provenance: { parserSha256: sha256(parser) } });
      validateCurrentWeekCandidate(currentWeek);
      currentWeekUi = adaptNormalizedCandidate(currentWeek);
    }
    if (legacySelection === "Save B" && !(normalized.season === 2026 && normalized.week === 2 && normalized.team.record === "1-0" && normalized.opponent.name === "Boston College" && normalized.location === "Away")) throw new Error("Save B parsed context does not match the approved Week 2 Boston College away-game expectations.");
    if (options && options["expected-context"]) {
      const expected = JSON.parse(fs.readFileSync(path.resolve(options["expected-context"]), "utf8"));
      const actual = { team: normalized.team.name, season: normalized.season, week: normalized.week, record: normalized.team.record, opponent: normalized.opponent.name, location: normalized.location };
      for (const [key, value] of Object.entries(expected)) if (actual[key] !== value) throw new Error(`Parsed context mismatch for ${key}: expected ${value}, received ${actual[key]}`);
    }
    const normalizedPath = path.join(runDir, "normalized", "dynasty.json"); writeJson(normalizedPath, normalized);
    const normalizedHash = sha256(normalizedPath);
    const staging = { schema_version: "dynasty_staging_v2", package_id: packageId, lineage: lineage(label, packageId, sourceBefore, snapshotPath), team: normalized.team.name, season: normalized.season, week: normalized.week, record: normalized.team.record, opponent: normalized.opponent, location: normalized.location, tactical_recommendations: { status: "unavailable_from_parser_export", recommendations: [] } };
    const stagingPath = path.join(runDir, "staging", "package.json"); writeJson(stagingPath, staging);
    const previewData = { schema_version: "dynasty_browser_preview_v2", package_id: packageId, lineage: lineage(label, packageId, sourceBefore, snapshotPath), team: staging.team, season: staging.season, week: staging.week, record: staging.record, opponent: staging.opponent.name, location: staging.location, tactical_recommendations: staging.tactical_recommendations };
    const previewDataPath = path.join(runDir, "preview", "data", "package.json"); writeJson(previewDataPath, previewData);
    const activePackage = generateActivePackageArtifacts(runDir, normalized, packageId, runId, sourceBefore, normalizedHash, currentWeekUi);
    const realShell = realShellPreview(runDir, normalized, packageId, activePackage, undefined, currentWeekUi);
    Object.assign(manifest, { package_id: packageId, refresh_id: runId, normalized_sha256: normalizedHash, artifacts: { raw: rawExport, normalized: normalizedPath, staging: stagingPath, preview_data: previewDataPath, real_shell: realShell, active_package: activePackage }, browser_expectation: { package_id: packageId, runtime: "real_repository_application_shell", team: previewData.team, season: previewData.season, week: previewData.week, record: previewData.record, opponent: previewData.opponent, location: previewData.location } });
    manifest.checks.push({ name: "single_package_id", status: "PASS" }, { name: "save_hash_lineage", status: "PASS" }, { name: "normalized_hash_recorded", status: "PASS" }, { name: "neutral_active_package_generated", status: "PASS" }, { name: "unsupported_domains_unavailable", status: "PASS" }, { name: "real_application_shell_generated", status: "PASS" });
    manifest.status = "PASS"; writeJson(manifestPath, manifest); return { manifestPath, manifest };
  } catch (error) { manifest.failure = error.message; writeJson(manifestPath, manifest); error.manifestPath = manifestPath; throw error; }
}

if (require.main === module) {
  try { const result = run(parseArgs(process.argv.slice(2))); process.stdout.write(`${JSON.stringify({ status: "PASS", manifest: result.manifestPath, ...result.manifest.browser_expectation }, null, 2)}\n`); }
  catch (error) { process.stderr.write(`${JSON.stringify({ status: "FAIL", reason: error.message, manifest: error.manifestPath || null }, null, 2)}\n`); process.exitCode = 1; }
}

module.exports = { SAVE_A_SHA256, generateActivePackageArtifacts, generateRutgersMediaWrapper, normalize, opponentIdentity, parseArgs, realShellPreview, replaceStartupBlock, run, sha256, sha256Text, stableJson, wrapperScript };
