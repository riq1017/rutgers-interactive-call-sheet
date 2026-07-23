#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith("--") || argv[i + 1] === undefined) throw new Error(`Expected --name value near ${argv[i] || "end"}`);
    out[argv[i].slice(2)] = argv[i + 1];
  }
  if (!out.root && !out.url && !out.simulation) throw new Error("--root, --url, or --simulation is required");
  return out;
}

function assert(condition, message) { if (!condition) throw new Error(message); }
function expected(pathname) {
  if (!pathname) return {};
  const raw = JSON.parse(fs.readFileSync(pathname, "utf8"));
  const context = raw.context || {};
  const expectedDom = raw.expected_dom || {};
  return { ...context, ...raw, record: context.record ?? expectedDom.seasonRecord, expected_dom: expectedDom };
}

function startupPassed(sequence) {
  return Array.isArray(sequence) && sequence.length === 3 && sequence[0] === "VALIDATED" && sequence[1] === "INSTALLED" && sequence[2] === "BOOTED";
}

function storageAttackRejected(proof) {
  return proof && proof.validationOk === false && proof.errorCode === "STALE_STORED_PACKAGE" && !String(proof.text || "").includes("Stored Stale Opponent");
}

function simulation(file, wanted) {
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  assert(value.http_status === 200, "Hosted page did not return HTTP 200");
  for (const key of ["team", "season", "week", "record", "opponent", "location", "package_id", "refresh_id"])
    if (wanted[key] !== undefined) assert(value[key] === wanted[key], `Browser context mismatch: ${key}`);
  assert(startupPassed(value.startup), "Startup sequence failed");
  assert(value.release_id === wanted.release_id || wanted.release_id === undefined, "Release mismatch");
  assert(value.active_packages === 1 && !value.legacy_resources && !value.console_errors, "Browser resource or console gate failed");
  assert(value.clean_reload && value.warm_reload && value.mobile && value.storage_override_rejected, "Browser reload/mobile/storage gate failed");
  if (wanted.commit) assert(value.commit === wanted.commit, "Hosted deployment commit mismatch");
  return { status: "PASS", mode: "simulation", ...value };
}

function staticServer(root) {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://local").pathname);
    const relative = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
    const file = path.resolve(root, relative);
    if (!file.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end("not found"); return; }
    response.writeHead(200, { "Content-Type": file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : "application/octet-stream", "Cache-Control": "public,max-age=3600" });
    fs.createReadStream(file).pipe(response);
  });
  return new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function pagesRepository(hostedUrl) {
  const url = new URL(hostedUrl);
  const owner = url.hostname.match(/^([^.]+)\.github\.io$/i)?.[1];
  const repository = url.pathname.split("/").filter(Boolean)[0];
  if (!owner || !repository) throw new Error("Hosted URL does not identify a GitHub Pages repository");
  return `${owner}/${repository}`;
}

async function waitForPagesCommit(hostedUrl, commit, timeoutMs) {
  const repository = pagesRepository(hostedUrl), deadline = Date.now() + timeoutMs;
  let last = null;
  do {
    const result = spawnSync("gh", ["api", `repos/${repository}/pages/builds/latest`, "--jq", "[.commit,.status]|@tsv"], { encoding: "utf8", windowsHide: true });
    if (result.status !== 0) throw new Error(`GitHub Pages commit check failed: ${(result.stderr || result.stdout || "gh unavailable").trim()}`);
    const [deployed, status] = result.stdout.trim().split("\t"); last = { deployed, status };
    if (deployed === commit && status === "built") return last;
    await new Promise(resolve => setTimeout(resolve, 5000));
  } while (Date.now() < deadline);
  throw new Error(`GitHub Pages did not confirm release commit ${commit}; latest was ${last?.deployed || "unknown"} (${last?.status || "unknown"})`);
}

async function inspect(page, wanted, releaseId) {
  const proof = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    text: document.body.innerText,
    weekOpponent: document.getElementById("weekOpponent")?.textContent?.trim() || null,
    seasonRecord: document.getElementById("seasonRecord")?.textContent?.trim() || null,
    scripts: [...document.scripts].map(item => item.src).filter(Boolean),
    startup: globalThis.CFB27_PRODUCTION_STARTUP_RESULT?.sequence || globalThis.CFB27_ACTIVE_PACKAGE_STARTUP_ORDER || [],
    startupStatus: document.documentElement.dataset.startupStatus || null,
    startupPackageId: globalThis.CFB27_PRODUCTION_STARTUP_RESULT?.package_id || globalThis.CFB27_ACTIVE_PACKAGE_VALIDATION?.package_id || null,
    startupRefreshId: globalThis.CFB27_PRODUCTION_STARTUP_RESULT?.refresh_id || globalThis.CFB27_ACTIVE_PACKAGE_VALIDATION?.refresh_id || null,
    domProof: document.documentElement.dataset.domProof || null,
    width: document.documentElement.scrollWidth,
    viewport: innerWidth
  }));
  assert(proof.weekOpponent === wanted.expected_dom.weekOpponent, `Weekly opponent DOM mismatch: expected ${wanted.expected_dom.weekOpponent}, received ${proof.weekOpponent}; url=${proof.url}; title=${proof.title}; body=${proof.text.slice(0, 160)}`);
  assert(proof.seasonRecord === wanted.expected_dom.seasonRecord, `Season record DOM mismatch: expected ${wanted.expected_dom.seasonRecord}, received ${proof.seasonRecord}`);
  assert(proof.domProof === "PASS" || (proof.startupStatus === "booted" && startupPassed(proof.startup)), "Startup/DOM proof failed");
  assert(!wanted.package_id || proof.startupPackageId === wanted.package_id, "Startup package ID mismatch");
  assert(!wanted.refresh_id || proof.startupRefreshId === wanted.refresh_id, "Startup refresh ID mismatch");
  const active = new Set(proof.scripts.map(value => {
    const pathname = new URL(value).pathname;
    const match = pathname.match(/\/data\/active-packages\/([^/]+)\//) ||
      pathname.match(/\/data\/generated\/dynasty\/refresh_runs\/[^/]+\/preview\/real-shell\/active-package\/([^/]+)\//);
    return match && match[1];
  }).filter(Boolean));
  assert(active.size === 1, "Expected exactly one production active package request");
  assert(!proof.scripts.some(value => /engine_data|phase1_verified|save-preview-bridge|app-definitions|purdue|opponent.media/i.test(new URL(value).pathname)), "Legacy resource requested");
  if (releaseId) for (const value of proof.scripts) {
    const url = new URL(value); const tokens = url.searchParams.getAll("r");
    assert(tokens.length === 1 && tokens[0] === releaseId, `Release token mismatch: ${url.pathname}`);
  }
  return proof;
}

async function inspectCurrentWeekScreens(page, wanted) {
  const current = wanted.current_week || {};
  if (!current.roster_count) return { status: "not-applicable" };
  const proof = await page.evaluate(() => {
    const home = document.getElementById("gameplanHome")?.innerText || "";
    const call = (name, ...args) => typeof globalThis[name] === "function" ? globalThis[name](...args) : null;
    call("renderPersonnelMatchups", "rutgers");
    const roster = { cards: document.querySelectorAll("[data-player-card]").length, declared: Number(document.querySelector("[data-roster-card-count]")?.dataset.rosterCardCount || 0) };
    const firstId = globalThis.CURRENT_WEEK_UI_PREVIEW?.roster?.players?.[0]?.player_id;
    if (firstId) call("showPlayerDetail", firstId, "rutgers", "all");
    const playerDetail = document.querySelector("[data-player-detail]")?.innerText || "";
    call("renderPersonnelMatchups", "stats");
    const stats = document.querySelector("[data-current-week-stats]")?.innerText || "";
    const injuries = Number(document.querySelector("[data-injury-count]")?.dataset.injuryCount || 0);
    call("renderRecruiting");
    const recruiting = document.getElementById("recruiting")?.innerText || "";
    const interest = Number(document.querySelector("[data-interest-pool-count]")?.dataset.interestPoolCount || 0);
    call("renderPersonnelMatchups", "opponent");
    const opponent = document.querySelector("[data-roster-hub='opponent']")?.innerText || "";
    const opponentPlayers = document.querySelectorAll("[data-roster-hub='opponent'] [data-player-card]").length;
    call("renderPersonnelMatchups", "matchups");
    const matchups = document.getElementById("personnelPanel")?.innerText || "";
    return { home, roster, playerDetail, stats, injuries, recruiting, interest, opponent, opponentPlayers, matchups };
  });
  for (const leader of current.leaders || []) assert(proof.home.includes(leader.name) && proof.home.includes(String(leader.value)), `Missing calculated current-week leader: ${leader.name} (${leader.value})`);
  assert(proof.roster.cards === current.roster_count && proof.roster.declared === current.roster_count, `Current-week roster did not render ${current.roster_count} players`);
  assert(/Biography|Full Ratings/.test(proof.playerDetail), "Current-week player detail did not render");
  const last = current.last_game || {};
  assert(proof.stats.includes(`Source ${last.source_id}`) && proof.stats.includes(`${last.opponent} ${last.opponent_score}, Rutgers ${last.rutgers}`) && proof.injuries === current.injury_count, "Last-game or injury screen mismatch");
  if (!wanted.normalized_recruiting) {
    const recruiting = current.recruiting || {};
    if (recruiting.available) assert(proof.recruiting.includes(recruiting.label) && proof.interest === recruiting.count && !proof.recruiting.includes("Active Board"), "Recruiting interest labeling/count mismatch");
    else assert(proof.recruiting.includes("Recruiting data unavailable") && proof.recruiting.includes(recruiting.reason) && proof.interest === 0 && !proof.recruiting.includes("Rutgers Interest Pool"), "Explicit recruiting-unavailable state mismatch");
  }
  if (Number(wanted.week) === 4 && wanted.opponent === "FCS East") {
    assert(proof.opponentPlayers === 0 && proof.opponent.includes("Detailed opponent data is unavailable for FCS placeholder teams."), "FCS opponent fallback mismatch");
    assert(!/USC|UMass|Boston College|Purdue/.test(proof.opponent), "Stale opponent content survived FCS fallback");
    assert(proof.matchups.includes("matchups are unavailable"), "FCS matchup fallback mismatch");
  } else {
    assert(proof.opponent.includes(wanted.opponent), "Current opponent view did not retain the verified opponent");
  }
  return { status: "PASS", roster: current.roster_count, injuries: current.injury_count, previous_game: last, opponent: wanted.opponent };
}

async function inspectNormalizedRecruiting(page, wanted) {
  const expectedRecruiting = wanted.normalized_recruiting;
  if (!expectedRecruiting) return { status: "not-applicable" };
  const proof = await page.evaluate(() => {
    if (typeof globalThis.renderRecruiting === "function") globalThis.renderRecruiting();
    const root = document.querySelector("[data-recruiting-schema]");
    const metrics = Object.fromEntries([...document.querySelectorAll(".recruiting-summary-metric")].map(node => [
      node.querySelector("span")?.textContent?.trim() || "",
      node.querySelector("strong")?.textContent?.trim() || ""
    ]));
    const modes = {};
    for (const mode of ["board", "offers", "visits", "pitches"]) {
      if (typeof globalThis.renderNormalizedRecruitingMode === "function") globalThis.renderNormalizedRecruitingMode(mode);
      modes[mode] = {
        selected: document.querySelector("[data-recruiting-mode]")?.dataset.recruitingMode || null,
        rows: document.querySelectorAll("[data-recruit-id]").length,
        empty: document.querySelector(`[data-recruiting-empty="${mode}"]`)?.textContent?.trim() || ""
      };
    }
    if (typeof globalThis.renderNormalizedRecruitingMode === "function") globalThis.renderNormalizedRecruitingMode("board");
    const panel = document.getElementById("recruiting");
    return {
      schema: root?.dataset.recruitingSchema || null,
      metrics,
      text: panel?.innerText || "",
      empty: document.querySelector("[data-recruiting-empty='board']")?.innerText || "",
      rows: document.querySelectorAll("[data-recruit-id]").length,
      tabs: [...document.querySelectorAll("[data-normalized-recruit-tab]")].map(node => node.dataset.normalizedRecruitTab),
      modes,
      panelWidth: panel?.scrollWidth || 0,
      viewport: innerWidth
    };
  });
  const summary = expectedRecruiting.summary || {};
  assert(proof.schema === expectedRecruiting.schema_version, "Normalized recruiting schema did not render");
  const metrics = {
    "Weekly Hours": summary.totalHours,
    "Assigned Hours": summary.assignedHours,
    "Processed Hours": summary.processedHours,
    "Board Count": summary.boardCount,
    "Offers": summary.offerCount,
    "Active Pitches": summary.pitchCount,
    "Visits": summary.visitCount
  };
  for (const [label, value] of Object.entries(metrics)) assert(proof.metrics[label] === String(value), `Recruiting summary mismatch for ${label}`);
  assert(JSON.stringify(proof.tabs) === JSON.stringify(["board", "offers", "visits", "pitches"]), "Recruiting view tabs are incomplete or unstable");
  for (const mode of ["board", "offers", "visits", "pitches"]) assert(proof.modes[mode].selected === mode, `Recruiting ${mode} view did not activate`);
  if (expectedRecruiting.empty_board_message) {
    assert(proof.empty.includes(expectedRecruiting.empty_board_message), "Rutgers empty-board state did not render");
    assert(proof.rows === 0, "Rutgers empty board rendered fabricated recruit rows");
    for (const mode of ["board", "offers", "visits", "pitches"]) assert(proof.modes[mode].rows === 0 && proof.modes[mode].empty, `Recruiting ${mode} empty state failed`);
  }
  assert(!/\bUncommitted\b/i.test(proof.text), "Recruiting UI inferred an uncommitted state");
  assert(proof.panelWidth <= proof.viewport + 1, "Recruiting panel has horizontal overflow");
  return { status: "PASS", schema: proof.schema, metrics: proof.metrics, rows: proof.rows, empty_board: Boolean(expectedRecruiting.empty_board_message) };
}

async function browserProof(options) {
  const wanted = expected(options.expected);
  if (options["release-id"]) wanted.release_id = options["release-id"];
  if (options.commit) wanted.commit = options.commit;
  if (options.simulation) return simulation(options.simulation, wanted);
  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch (error) { throw new Error(`Playwright is required for real browser validation: ${error.message}`); }
  let server = null;
  const timeout = Number(options.timeout || 45) * 1000;
  const url = options.url || await (async () => {
    server = await staticServer(path.resolve(options.root));
    const relative = String(options.path || "").replace(/\\/g, "/").replace(/^\/+/, "");
    return `http://127.0.0.1:${server.address().port}/${relative}`;
  })();
  const deployed = options.commit ? await waitForPagesCommit(url, options.commit, timeout) : null;
  const errors = [], failedResources = [];
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CFB27_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => { if (response.status() >= 400) failedResources.push(`${response.status()} ${response.url()}`); });
    page.on("requestfailed", request => failedResources.push(`FAILED ${request.url()} ${request.failure()?.errorText || "unknown"}`));
    const response = await page.goto(`${url}${url.includes("?") ? "&" : "?"}validation=clean-${Date.now()}`, { waitUntil: "load", timeout });
    assert(response && response.status() === 200, "Hosted page did not return HTTP 200");
    const clean = await inspect(page, wanted, options["release-id"]);
    const currentWeekScreens = await inspectCurrentWeekScreens(page, wanted);
    const recruitingClean = await inspectNormalizedRecruiting(page, wanted);
    await page.reload({ waitUntil: "load", timeout });
    const warm = await inspect(page, wanted, options["release-id"]);
    const recruitingWarm = await inspectNormalizedRecruiting(page, wanted);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "load", timeout });
    const mobile = await inspect(page, wanted, options["release-id"]);
    const recruitingMobile = await inspectNormalizedRecruiting(page, wanted);
    assert(mobile.width <= mobile.viewport + 1, "Mobile page has horizontal overflow");
    const attackContext = await browser.newContext();
    await attackContext.addInitScript(() => localStorage.setItem("rutgers_weekly_package", JSON.stringify({ package_id: "stored-stale-package", opponent: "Stored Stale Opponent" })));
    const attackPage = await attackContext.newPage();
    const attackResponse = await attackPage.goto(`${url}${url.includes("?") ? "&" : "?"}validation=storage-attack-${Date.now()}`, { waitUntil: "load", timeout });
    assert(attackResponse && attackResponse.status() === 200, "Stored-package attack page did not return HTTP 200");
    const attack = await attackPage.evaluate(() => ({
      validationOk: (globalThis.CFB27_PACKAGE_VALIDATION_RESULT || globalThis.CFB27_ACTIVE_PACKAGE_VALIDATION)?.ok,
      errorCode: globalThis.CFB27_PRODUCTION_STARTUP_RESULT?.error_code || globalThis.CFB27_PACKAGE_VALIDATION_RESULT?.error_code || globalThis.CFB27_ACTIVE_PACKAGE_VALIDATION?.error_code || null,
      text: document.body.innerText
    }));
    await attackContext.close();
    assert(storageAttackRejected(attack), `Stored package attack was not rejected safely: ${JSON.stringify(attack)}`);
    assert(errors.length === 0, `Browser console errors: ${errors.join(" | ")}`);
    assert(failedResources.length === 0, `Browser resource failures: ${failedResources.join(" | ")}`);
    return { status: "PASS", url, http_status: 200, deployed_commit: deployed?.deployed || null, clean_reload: true, warm_reload: true, mobile: true, console_errors: [], failed_resources: [], dom_proof: clean.domProof || clean.startupStatus, current_week_screens: currentWeekScreens, recruiting_ui: { clean: recruitingClean, warm: recruitingWarm, mobile: recruitingMobile }, storage_override_rejected: true, package_id: clean.startupPackageId, refresh_id: clean.startupRefreshId, release_id: options["release-id"] || null, startup: clean.startup };
  } finally { await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); }
}

if (require.main === module) browserProof(args(process.argv.slice(2))).then(result => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch(error => { process.stderr.write(`${JSON.stringify({ status: "FAIL", reason: error.message }, null, 2)}\n`); process.exitCode = 1; });
module.exports = { args, browserProof, expected, inspectCurrentWeekScreens, inspectNormalizedRecruiting, pagesRepository, simulation, startupPassed, storageAttackRejected };
