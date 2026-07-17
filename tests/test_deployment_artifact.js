"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { generateHtml, generateWebManifest, run, token } = require("../tools/assemble_deployment");
const { ArtifactError, WRAPPER_ORDER, sha256File, validateArtifact } = require("../tools/validate_deployment_artifact");

const HASH = "a".repeat(64);
const PACKAGE_ID = "synthetic-rutgers-2026-w02-abcdef123456";
const REFRESH_ID = "synthetic-refresh-20260717";
const RELEASE_ID = "cfb27-shell-test-20260717t180000z";
const CONTEXT = { team_id: "78", season: 2026, week: 2, opponent_id: "4", opponent_name: "Boston College" };
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function wrapper(declaration) {
  return `"use strict";\n(function(root){root.ACTIVE_PACKAGE_ARTIFACTS=root.ACTIVE_PACKAGE_ARTIFACTS||Object.create(null);if(root.ACTIVE_PACKAGE_ARTIFACTS[${JSON.stringify(declaration.artifact)}])throw new Error("Duplicate active-package artifact: ${declaration.artifact}");root.ACTIVE_PACKAGE_ARTIFACTS[${JSON.stringify(declaration.artifact)}]=Object.freeze(${stable(declaration)});${declaration.artifact === "weekly_manifest" ? `root.ACTIVE_PACKAGE_MANIFEST=Object.freeze(${stable(declaration.payload)});` : ""}})(globalThis);\n`;
}
function payload(name) {
  if (name === "weekly_manifest") return { schema_version: "cfb27_weekly_manifest_v1", package_id: PACKAGE_ID, refresh_id: REFRESH_ID, ...CONTEXT };
  if (name === "weekly_plan") return { team: { id: "78", name: "Rutgers", record: "1-0" }, season: 2026, week: 2, opponent: "Boston College", opponent_id: "4", location: "Away" };
  if (name === "gameplan_weekly") return { team_id: "78", team_name: "Rutgers", record: "1-0", season: 2026, week: 2, opponent_id: "4", opponent: "Boston College", location: "Away" };
  if (name === "rutgers_roster") return { team: { id: "78", name: "Rutgers", record: "1-0" }, player_count: 1, players: [{ id: "1", player_id: "1", name: "Test Player", position: "QB" }] };
  if (name === "current_opponent") return { id: "4", name: "Boston College", player_count: 0, players: [] };
  return null;
}
function makePackage(root) {
  const dir = path.join(root, PACKAGE_ID); fs.mkdirSync(dir);
  const artifacts = {};
  for (const name of WRAPPER_ORDER) {
    const available = ["weekly_manifest", "weekly_plan", "gameplan_weekly", "rutgers_roster", "current_opponent"].includes(name);
    const text = wrapper({ schema_version: "cfb27_artifact_declaration_v1", artifact: name, package_id: PACKAGE_ID, refresh_id: REFRESH_ID, ...CONTEXT, status: available ? "available" : "unavailable", payload: payload(name) });
    fs.writeFileSync(path.join(dir, `${name}.js`), text);
    artifacts[name] = { sha256: crypto.createHash("sha256").update(text).digest("hex"), required: available, status: available ? "available" : "unavailable" };
  }
  fs.writeFileSync(path.join(dir, "active_package.js"), `"use strict";globalThis.ACTIVE_DYNASTY_PACKAGE=Object.freeze(${stable({ schema_version: "cfb27_active_package_v1", package_id: PACKAGE_ID, refresh_id: REFRESH_ID, source_sha256: HASH, snapshot_sha256: HASH, normalized_sha256: "b".repeat(64), ...CONTEXT, artifacts })});\n`);
  return dir;
}
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "deployment-artifact-test-"));
  const packageDir = makePackage(root), outputRoot = path.join(root, "outputs");
  const result = run({ "package-dir": packageDir, "release-id": RELEASE_ID, "output-root": outputRoot, "source-commit": "bf8d185c99998c5b1e1a5cbe0ffba2a4e6593a24" });
  return { root, packageDir, outputRoot, artifact: result.directory, result };
}
function refreshManifest(artifact, rel) {
  const file = path.join(artifact, "deployment-manifest.json"), manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  manifest.files[rel] = { sha256: sha256File(path.join(artifact, rel)), size: fs.statSync(path.join(artifact, rel)).size };
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
}
function replaceDeclaredFile(artifact, rel, transform) {
  const file = path.join(artifact, rel);
  fs.writeFileSync(file, transform(fs.readFileSync(file, "utf8")));
  refreshManifest(artifact, rel);
}
function expectCode(artifact, code) {
  assert.throws(() => validateArtifact(artifact), error => error instanceof ArtifactError && error.code === code, `expected ${code}`);
}

test("assembler produces one self-contained validated immutable release and refuses overwrite", () => {
  const f = fixture();
  const result = validateArtifact(f.artifact);
  assert.deepEqual({ release_id: result.release_id, package_id: result.package_id, refresh_id: result.refresh_id }, { release_id: RELEASE_ID, package_id: PACKAGE_ID, refresh_id: REFRESH_ID });
  const html = fs.readFileSync(path.join(f.artifact, "index.html"), "utf8");
  assert.match(html, /CFB27_APP_STARTUP_MODE="controlled"/);
  assert.match(html, /production_startup\.js\?r=/);
  assert.doesNotMatch(html, /engine_data|recruiting_data|phase1_verified_data|data\/player_media|purdue|opponent[_-]media/i);
  assert.equal(fs.readdirSync(path.join(f.artifact, "data", "active-packages")).length, 1);
  assert.throws(() => run({ "package-dir": f.packageDir, "release-id": RELEASE_ID, "output-root": f.outputRoot }), /already exists/i);
});

test("immutable package path fixtures fail closed and an exact release-specific shell remains reusable", async t => {
  await t.test("one correctly referenced immutable package directory passes", () => {
    const f = fixture();
    assert.equal(validateArtifact(f.artifact).ok, true);
  });
  const cases = [
    ["missing active_package.js", "MISSING_DEPLOYED_FILE", f => fs.unlinkSync(path.join(f.artifact, `data/active-packages/${PACKAGE_ID}/active_package.js`))],
    ["incorrect package-directory basename", "UNDECLARED_FILE", f => {
      const from = path.join(f.artifact, "data", "active-packages", PACKAGE_ID);
      fs.renameSync(from, path.join(path.dirname(from), `${PACKAGE_ID}-wrong`));
    }],
    ["index referencing a different package ID", "TRANSITIVE_RESOURCE_MISSING", f => {
      replaceDeclaredFile(f.artifact, "index.html", text => text.replaceAll(`data/active-packages/${PACKAGE_ID}/`, "data/active-packages/different-package-id/"));
    }],
    ["wrapper loaded from a second package directory", "UNDECLARED_FILE", f => {
      const second = path.join(f.artifact, "data", "active-packages", "second-package", "weekly_plan.js");
      fs.mkdirSync(path.dirname(second), { recursive: true });
      fs.copyFileSync(path.join(f.artifact, `data/active-packages/${PACKAGE_ID}/weekly_plan.js`), second);
    }],
    ["mutable data active path", "LEGACY_RESOURCE_FORBIDDEN", f => {
      replaceDeclaredFile(f.artifact, "index.html", text => text.replace(`data/active-packages/${PACKAGE_ID}/active_package.js`, "data/active/active_package.js"));
    }],
    ["package resource outside the artifact", "TRANSITIVE_RESOURCE_MISSING", f => {
      replaceDeclaredFile(f.artifact, "index.html", text => text.replace(`data/active-packages/${PACKAGE_ID}/active_package.js`, `data/active-packages/${PACKAGE_ID}/outside.js`));
    }]
  ];
  for (const [name, code, mutate] of cases) await t.test(name, () => { const f = fixture(); mutate(f); expectCode(f.artifact, code); });
  await t.test("exact r3-style release-specific index structure passes", () => {
    const f = fixture();
    const current = fs.readFileSync(path.join(f.artifact, "index.html"), "utf8");
    const generated = generateHtml("cfb27-week2-boston-college-r3", PACKAGE_ID, current);
    assert.equal(generated.sources.length, 16);
    assert.match(generated.html, /CFB27_DEPLOYMENT_RELEASE_ID="cfb27-week2-boston-college-r3"/);
    assert.equal((generated.html.match(/data\/active-packages\//g) || []).length, 11);
    assert.equal((generated.html.match(/production_startup\.js/g) || []).length, 1);
    assert.doesNotMatch(generated.html, /data\/active\/|engine_data|recruiting_data|phase1_verified_data|data\/player_media|purdue|opponent[_-]media/i);
  });
});

test("release cache tokens are normalized across approved local resources", async t => {
  const r4 = "cfb27-week2-boston-college-r4";
  const legacy = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  await t.test("missing release tokens are added", () => {
    const generated = generateHtml(r4, PACKAGE_ID, legacy).html;
    for (const rel of ["manifest.webmanifest", "styles.css", "assets/app-icon.svg"]) assert.match(generated, new RegExp(`${rel.replaceAll(".", "\\.")}\\?r=${r4}`));
  });
  await t.test("existing and duplicate release tokens are replaced once while unrelated parameters remain", () => {
    const old = generateHtml("old-release-token", PACKAGE_ID, legacy).html
      .replace("manifest.webmanifest?r=old-release-token", "manifest.webmanifest?v=7&r=old-release-token&r=older#manifest")
      .replace("styles.css?r=old-release-token", "styles.css?theme=scarlet&r=old-release-token");
    const generated = generateHtml(r4, PACKAGE_ID, old).html;
    const refs = [...generated.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]);
    for (const ref of refs) {
      const url = new URL(ref, "https://artifact.invalid/");
      assert.deepEqual(url.searchParams.getAll("r"), [r4], ref);
    }
    assert.match(generated, /manifest\.webmanifest\?v=7&amp;|manifest\.webmanifest\?v=7&r=/);
    assert.match(generated, /v=7/); assert.match(generated, /#manifest/); assert.match(generated, /theme=scarlet/);
    assert.doesNotMatch(generated, /old-release-token|r=older/);
  });
  await t.test("manifest stylesheet icon script and immutable package URLs agree", () => {
    const generated = generateHtml(r4, PACKAGE_ID, legacy).html;
    const refs = [...generated.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]);
    assert.ok(refs.some(ref => ref.startsWith("manifest.webmanifest?")));
    assert.ok(refs.some(ref => ref.startsWith("styles.css?")));
    assert.ok(refs.some(ref => ref.startsWith("assets/app-icon.svg?")));
    assert.ok(refs.some(ref => ref.startsWith(`data/active-packages/${PACKAGE_ID}/active_package.js?`)));
    for (const ref of refs) assert.equal(new URL(ref, "https://artifact.invalid/").searchParams.get("r"), r4, ref);
    assert.equal((generated.match(/CFB27_DEPLOYMENT_RELEASE_ID/g) || []).length, 1);
  });
  await t.test("web manifest tokens replace prior values without duplication", () => {
    const source = fs.readFileSync(path.join(__dirname, "..", "manifest.webmanifest"), "utf8");
    const value = JSON.parse(source); value.start_url = "./index.html?mode=app&r=old&r=older"; value.icons[0].src = "assets/app-icon.svg?purpose=any&r=old";
    const original = fs.readFileSync;
    fs.readFileSync = (file, encoding) => path.basename(String(file)) === "manifest.webmanifest" ? JSON.stringify(value) : original(file, encoding);
    try {
      const generated = JSON.parse(generateWebManifest(r4));
      for (const ref of [generated.start_url, ...generated.icons.map(icon => icon.src)]) assert.deepEqual(new URL(ref, "https://artifact.invalid/").searchParams.getAll("r"), [r4]);
      assert.match(generated.start_url, /mode=app/); assert.match(generated.icons[0].src, /purpose=any/);
    } finally { fs.readFileSync = original; }
  });
  assert.equal(token("app.js?mode=controlled&r=old&r=older#boot", r4), `app.js?mode=controlled&r=${r4}#boot`);
});

test("mixed-byte and unsafe artifact fixtures fail with deterministic codes", async t => {
  const cases = [
    ["new marker with old wrapper", "ARTIFACT_HASH_MISMATCH", f => { const rel = `data/active-packages/${PACKAGE_ID}/weekly_plan.js`; fs.appendFileSync(path.join(f.artifact, rel), "// old wrapper\n"); refreshManifest(f.artifact, rel); }],
    ["old runtime with new package", "DEPLOYED_FILE_HASH_MISMATCH", f => fs.appendFileSync(path.join(f.artifact, "package_runtime.js"), "// old runtime\n")],
    ["old app with new controller", "DEPLOYED_FILE_HASH_MISMATCH", f => fs.appendFileSync(path.join(f.artifact, "app.js"), "// old app\n")],
    ["mismatched release token", "RELEASE_ID_CONFLICT", f => { const file = path.join(f.artifact, "index.html"); fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(`app.js?r=${RELEASE_ID}`, "app.js?r=other-release")); refreshManifest(f.artifact, "index.html"); }],
    ["modified wrapper unchanged ID", "ARTIFACT_HASH_MISMATCH", f => { const rel = `data/active-packages/${PACKAGE_ID}/gameplan_weekly.js`; fs.appendFileSync(path.join(f.artifact, rel), " "); refreshManifest(f.artifact, rel); }],
    ["missing required wrapper", "MISSING_DEPLOYED_FILE", f => fs.unlinkSync(path.join(f.artifact, `data/active-packages/${PACKAGE_ID}/weekly_plan.js`))],
    ["missing optional wrapper marked available", "MISSING_DEPLOYED_FILE", f => fs.unlinkSync(path.join(f.artifact, `data/active-packages/${PACKAGE_ID}/statistics.js`))],
    ["extra unauthorized file", "UNDECLARED_FILE", f => fs.writeFileSync(path.join(f.artifact, "extra.txt"), "unauthorized")],
    ["incomplete media set", "MISSING_DEPLOYED_FILE", f => { const manifest = JSON.parse(fs.readFileSync(path.join(f.artifact, "deployment-manifest.json"), "utf8")); const rel = Object.keys(manifest.files).find(name => name.startsWith("assets/player-portraits/rutgers/")); fs.unlinkSync(path.join(f.artifact, rel)); }],
    ["old shell with new scripts", "LEGACY_RESOURCE_FORBIDDEN", f => { const file = path.join(f.artifact, "index.html"); fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("</body>", '<script src="data/engine_data.js?r=' + RELEASE_ID + '"></script></body>')); refreshManifest(f.artifact, "index.html"); }]
  ];
  for (const [name, code, mutate] of cases) await t.test(name, () => { const f = fixture(); mutate(f); expectCode(f.artifact, code); });
});

test("semantic stale-runtime validation rejects active dependencies but permits defensive rejection", async t => {
  const cases = [
    ["active Purdue global access", "LEGACY_RUNTIME_GLOBAL_ACCESS", f => replaceDeclaredFile(f.artifact, "app.js", text => `${text}\nvoid PURDUE_MATCHUPS;\n`)],
    ["active UMass fallback logic", "OPPONENT_SPECIFIC_FALLBACK", f => replaceDeclaredFile(f.artifact, "app.js", text => `${text}\nfunction loadUMassFallback(){ return {}; }\n`)],
    ["Week 1 UMass production identity", "STALE_PRODUCTION_VERSION", f => replaceDeclaredFile(f.artifact, "app.js", text => text.replace(/APP_DATA_VERSION\s*=\s*["'][^"']+["']/, 'APP_DATA_VERSION = "week1_umass_fixture"'))],
    ["legacy global installed into compatibility surface", "LEGACY_COMPATIBILITY_GLOBAL", f => replaceDeclaredFile(f.artifact, "package_runtime.js", text => text.replace('"RUTGERS_ROSTER_BASE"]', '"RUTGERS_ROSTER_BASE", "PURDUE_MATCHUPS"]'))]
  ];
  for (const [name, code, mutate] of cases) await t.test(name, () => { const f = fixture(); mutate(f); expectCode(f.artifact, code); });
  const neutral = fixture();
  assert.equal(validateArtifact(neutral.artifact).ok, true, "defensive denylist and neutral active-package loading remain valid");
  const deployedApp = fs.readFileSync(path.join(neutral.artifact, "app.js"), "utf8");
  assert.doesNotMatch(deployedApp, /week\s*1|week1|umass|purdue/i);
  assert.doesNotMatch(deployedApp, /VIDEO_VERIFIED_(?:PURDUE|UMASS)|PLAYER_MATCHUPS|OPPONENT_(?:LAST_GAME_STATS|SEASON_STATS|PLAYER_MEDIA)/);
});

test("assembled scripts validate, install compatibility globals, and boot exactly once", () => {
  const f = fixture(), html = fs.readFileSync(path.join(f.artifact, "index.html"), "utf8");
  const sources = [...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(match => match[1].split("?")[0]);
  const nodes = new Map([["weekOpponent", { textContent: "" }], ["seasonRecord", { textContent: "" }]]);
  const document = { documentElement: { dataset: {} }, body: { replaceChildren(node) { this.child = node; } }, createElement() { return { dataset: {}, setAttribute() {} }; }, getElementById(id) { return nodes.get(id) || null; }, querySelectorAll() { return []; } };
  const scope = { console, document, globalThis: null, window: null, CFB27_APP_STARTUP_MODE: "controlled", localStorage: { getItem() { return null; } } }; scope.globalThis = scope; scope.window = scope;
  vm.createContext(scope);
  for (const source of sources.slice(0, -2)) vm.runInContext(fs.readFileSync(path.join(f.artifact, source), "utf8"), scope, { filename: source });
  let boots = 0; scope.CFB27_APP_BOOT = approval => { assert.equal(approval.startupApproved, true); boots += 1; return boots === 1 ? "BOOTED" : "ALREADY_BOOTED"; };
  vm.runInContext(fs.readFileSync(path.join(f.artifact, "production_startup.js"), "utf8"), scope);
  assert.deepEqual([...scope.CFB27_PRODUCTION_STARTUP_RESULT.sequence], ["VALIDATED", "INSTALLED", "BOOTED"]);
  assert.equal(boots, 1);
  assert.equal(scope.WEEKLY_PLAN.package_id, PACKAGE_ID);
  assert.equal(scope.GAMEPLAN_WEEKLY.refresh_id, REFRESH_ID);
  assert.equal(scope.CFB27_PRODUCTION_STARTUP.runProductionStartup(scope).error_code, "STARTUP_ALREADY_EXECUTED");
  assert.equal(boots, 1);
});

test("runtime failure blocks before install/boot, leaves roots inert, and renders exact fatal text", () => {
  const f = fixture(), runtime = require(path.join(f.artifact, "package_runtime.js")), startup = require(path.join(f.artifact, "production_startup.js"));
  const nodes = [{ inert: false, setAttribute(key, value) { this[key] = value; } }];
  const body = { replaceChildren(node) { this.child = node; } };
  const document = { documentElement: { dataset: {} }, body, querySelectorAll() { return nodes; }, createElement() { return { dataset: {}, setAttribute() {} }; } };
  let boots = 0;
  const scope = { CFB27_APP_STARTUP_MODE: "controlled", CFB27_PACKAGE_RUNTIME: runtime, CFB27_APP_BOOT() { boots += 1; }, document, localStorage: { getItem() { return null; } } };
  const result = startup.runProductionStartup(scope);
  assert.equal(result.error_code, "MISSING_PACKAGE_MARKER"); assert.equal(boots, 0); assert.equal(scope.WEEKLY_PLAN, undefined); assert.equal(nodes[0].inert, true);
  assert.equal(body.child.textContent, "Startup blocked: active package validation failed (MISSING_PACKAGE_MARKER). No dynasty package was loaded. Reload after the approved deployment completes.");
});

test("assembled artifact is self-contained when served and requests only declared resources", async () => {
  const f = fixture(), requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url); const clean = decodeURIComponent(request.url.split("?")[0]).replace(/^\//, "") || "index.html"; const file = path.join(f.artifact, clean);
    if (!file.startsWith(f.artifact + path.sep) || !fs.existsSync(file)) { response.writeHead(404).end(); return; }
    response.writeHead(200).end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port, html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
    for (const ref of refs) { const response = await fetch(`http://127.0.0.1:${port}/${ref}`); assert.equal(response.status, 200, ref); }
    assert.equal(requests.some(value => /engine_data|purdue|opponent[_-]media|phase1_verified_data|data\/player_media/i.test(value)), false);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
