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
function expected(pathname) { return pathname ? JSON.parse(fs.readFileSync(pathname, "utf8")) : {}; }

function simulation(file, wanted) {
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  assert(value.http_status === 200, "Hosted page did not return HTTP 200");
  for (const key of ["team", "season", "week", "record", "opponent", "location", "package_id", "refresh_id"])
    if (wanted[key] !== undefined) assert(value[key] === wanted[key], `Browser context mismatch: ${key}`);
  assert(value.startup?.join("→") === "VALIDATED→INSTALLED→BOOTED", "Startup sequence failed");
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
    title: document.title,
    text: document.body.innerText,
    scripts: [...document.scripts].map(item => item.src).filter(Boolean),
    startup: globalThis.CFB27_ACTIVE_PACKAGE_STARTUP_ORDER || [],
    domProof: document.documentElement.dataset.domProof || null,
    width: document.documentElement.scrollWidth,
    viewport: innerWidth
  }));
  const text = proof.text.toLowerCase();
  assert(text.includes(`week ${wanted.week}`.toLowerCase()) && text.includes(String(wanted.opponent).toLowerCase()) && text.includes(String(wanted.record).toLowerCase()), "Expected weekly DOM context is absent");
  assert(proof.domProof === "PASS" || (proof.startup.join("→") === "VALIDATED→INSTALLED→BOOTED"), "Startup/DOM proof failed");
  const active = new Set(proof.scripts.map(value => new URL(value).pathname.match(/\/data\/active-packages\/([^/]+)\//)?.[1]).filter(Boolean));
  assert(active.size <= 1, "Multiple production active packages were requested");
  assert(!proof.scripts.some(value => /engine_data|phase1_verified|save-preview-bridge|app-definitions|purdue|opponent.media/i.test(new URL(value).pathname)), "Legacy resource requested");
  if (releaseId) for (const value of proof.scripts) {
    const url = new URL(value); const tokens = url.searchParams.getAll("r");
    assert(tokens.length === 1 && tokens[0] === releaseId, `Release token mismatch: ${url.pathname}`);
  }
  return proof;
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
  const url = options.url || await (async () => { server = await staticServer(path.resolve(options.root)); return `http://127.0.0.1:${server.address().port}/`; })();
  const deployed = options.commit ? await waitForPagesCommit(url, options.commit, timeout) : null;
  const errors = [];
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CFB27_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => localStorage.setItem("rutgers_weekly_package", JSON.stringify({ package_id: "stored-stale-package", opponent: "Stored Stale Opponent" })));
    const page = await context.newPage();
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", error => errors.push(error.message));
    const response = await page.goto(`${url}${url.includes("?") ? "&" : "?"}validation=clean-${Date.now()}`, { waitUntil: "load", timeout });
    assert(response && response.status() === 200, "Hosted page did not return HTTP 200");
    const clean = await inspect(page, wanted, options["release-id"]);
    await page.reload({ waitUntil: "load", timeout });
    const warm = await inspect(page, wanted, options["release-id"]);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "load", timeout });
    const mobile = await inspect(page, wanted, options["release-id"]);
    assert(mobile.width <= mobile.viewport + 1, "Mobile page has horizontal overflow");
    assert(!mobile.text.includes("Stored Stale Opponent"), "Stored package replaced the active package");
    assert(errors.length === 0, `Browser console errors: ${errors.join(" | ")}`);
    return { status: "PASS", url, http_status: 200, deployed_commit: deployed?.deployed || null, clean_reload: true, warm_reload: true, mobile: true, console_errors: [], storage_override_rejected: true, package_id: wanted.package_id, refresh_id: wanted.refresh_id, release_id: options["release-id"] || null, startup: clean.startup };
  } finally { await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); }
}

if (require.main === module) browserProof(args(process.argv.slice(2))).then(result => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch(error => { process.stderr.write(`${JSON.stringify({ status: "FAIL", reason: error.message }, null, 2)}\n`); process.exitCode = 1; });
module.exports = { args, browserProof, pagesRepository, simulation };
