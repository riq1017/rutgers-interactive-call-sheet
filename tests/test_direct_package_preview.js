"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { generateHtml } = require("../tools/assemble_deployment");
const { generateActivePackageArtifacts, realShellPreview, replaceStartupBlock, sha256 } = require("../tools/refresh_save_a_preview");

function parsedResource(value, expectedReleaseId = null, allowUnversioned = false, allowedParameters = []) {
  const url = new URL(value, "https://preview.invalid/");
  const tokens = url.searchParams.getAll("r");
  if (expectedReleaseId !== null) assert.deepEqual(tokens, [expectedReleaseId], value);
  else if (allowUnversioned) assert.deepEqual(tokens, [], value);
  const allowed = new Set([...(expectedReleaseId === null ? [] : ["r"]), ...allowedParameters]);
  for (const key of url.searchParams.keys()) assert.ok(allowed.has(key), `unexpected query parameter ${key} in ${value}`);
  return { pathname: url.pathname.replace(/^\//, ""), url };
}
function sourcePaths(sources) { return sources.map(source => parsedResource(source, null, true).pathname); }

function fixture(sourceHtml) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "direct-package-preview-"));
  const run = path.join(root, "run-one");
  fs.mkdirSync(run);
  const normalized = { team: { id: 78, name: "Rutgers", record: "1-0" }, season: 2026, week: 2, opponent: { id: 4, name: "Boston College", player_count: 1, players: [{ player_id: "900", name: "BC Player", position: "QB" }] }, location: "Away", rutgers_player_count: 1, rutgers_players: [{ player_id: "1", name: "RU Player", position: "QB" }] };
  const active = generateActivePackageArtifacts(run, normalized, "package-one", "run-one", "a".repeat(64), "b".repeat(64));
  return { run, normalized, active, shell: realShellPreview(run, normalized, "package-one", active, sourceHtml) };
}

test("isolated shell uses the direct active package and an allowlist-only startup order", () => {
  const f = fixture();
  const html = fs.readFileSync(f.shell.index, "utf8");
  const sources = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
  const paths = sourcePaths(sources);
  assert.equal(paths.filter(src => src.endsWith("/active_package.js")).length, 1);
  assert.equal(paths.filter(src => src.endsWith("/weekly_manifest.js")).length, 1);
  assert.equal(paths.filter(src => src === "package_runtime.js").length, 1);
  assert.equal(paths.filter(src => src === "app.js").length, 1);
  assert.equal(paths.filter(src => src === "data/player_media.js").length, 0);
  assert.equal(paths.filter(src => src.endsWith("/rutgers_media.js")).length, 1);
  assert.equal(paths.filter(src => /save-preview-bridge/i.test(src)).length, 0);
  assert.equal(paths.filter(src => src.startsWith("data/active-packages/")).length, 0);
  for (const forbidden of ["purdue", "engine_data.js", "recruiting_data.js", "phase1_verified_data.js", "purdue_season_stats.js", "purdue_roster.js", "purdue_roster_recovery.js", "weekly/coaching_decisions.js", "weekly/run_lane_analysis.js", "weekly/weekly_matchup_summary.js"]) assert.equal(paths.filter(src => src.toLowerCase().includes(forbidden)).length, 0, forbidden);
  assert.deepEqual(paths, sourcePaths(f.shell.script_order));
  assert.match(html, /globalThis\.CFB27_APP_STARTUP_MODE="controlled";/);
  assert.doesNotMatch(html, /app-definitions\.js/);
  const mediaText = fs.readFileSync(f.shell.media.file, "utf8");
  assert.equal(f.shell.media.player_count, 48);
  assert.match(mediaText, /RUTGERS_PLAYER_MEDIA/);
  assert.match(mediaText, /player-portraits\/rutgers/);
  assert.doesNotMatch(mediaText, /OPPONENT_PLAYER_MEDIA|PLAYER_CARD_REGISTRY|purdue|umass|boston college|player-portraits\/opponent/i);
  assert.equal(f.shell.repository_app_js_sha256, sha256(path.join(__dirname, "..", "app.js")));
  assert.equal(f.shell.definitions, undefined);
  assert.equal(fs.existsSync(path.join(f.run, "preview", "real-shell", "app-definitions.js")), false);
  const startup = fs.readFileSync(f.shell.startup, "utf8");
  const validateAt = startup.indexOf("runtime.validateActivePackage");
  const installAt = startup.indexOf("runtime.installActivePackageCompatibilityGlobals");
  const bootAt = startup.indexOf("root.CFB27_APP_BOOT({startupApproved:true})");
  assert.ok(validateAt >= 0 && validateAt < installAt && installAt < bootAt);
  assert.match(startup, /CFB27_ACTIVE_PACKAGE_VALIDATION/);
  assert.match(startup, /CFB27_ACTIVE_PACKAGE_INSTALLATION/);
  assert.match(startup, /CFB27_APP_BOOT_RESULT/);
  assert.doesNotMatch(startup, /CFB27_ACTIVE_PACKAGE_PREFLIGHT/);
});

test("startup replacement accepts exactly one complete legacy or controlled block", () => {
  const legacy = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const replacement = '<script src="preview/package_runtime.js"></script>';
  const legacyResult = replaceStartupBlock(legacy, replacement);
  assert.equal(legacyResult.type, "legacy");
  assert.match(legacyResult.html, /preview\/package_runtime\.js/);
  assert.doesNotMatch(legacyResult.html, /data\/rutgers_team\.js/);

  const productionPackage = "production-package-fixture";
  const controlled = generateHtml("production-release-fixture", productionPackage, legacy).html;
  const controlledResult = replaceStartupBlock(controlled, replacement);
  assert.equal(controlledResult.type, "controlled");
  assert.equal(controlledResult.production_package_id, productionPackage);
  assert.match(controlledResult.html, /preview\/package_runtime\.js/);
  assert.doesNotMatch(controlledResult.html, /data\/active-packages\//);
  const controlledPreview = fixture(controlled);
  const controlledPreviewHtml = fs.readFileSync(controlledPreview.shell.index, "utf8");
  const controlledPreviewPaths = sourcePaths([...controlledPreviewHtml.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]));
  assert.equal(controlledPreview.shell.replaced_startup_type, "controlled");
  assert.equal(controlledPreview.shell.replaced_production_package_id, productionPackage);
  assert.deepEqual(controlledPreviewPaths, sourcePaths(controlledPreview.shell.script_order));
  assert.equal(controlledPreviewPaths.filter(value => value.startsWith("data/active-packages/")).length, 0);

  assert.throws(() => replaceStartupBlock("<html><body></body></html>", replacement), /No supported startup block/);
  const legacyBlock = legacy.slice(legacy.indexOf('<script src="data/rutgers_team.js"'), legacy.indexOf("</body>"));
  assert.throws(() => replaceStartupBlock(legacy.replace("</body>", `${legacyBlock}</body>`), replacement), /Multiple supported startup blocks/);
  assert.throws(() => replaceStartupBlock(controlled.replace(/<script src="production_startup\.js[^"]*"><\/script>/, ""), replacement), /incomplete|unexpected/i);
  assert.throws(() => replaceStartupBlock(controlled.replace(/<script src="app\.js[^"]*"><\/script>/, '<script src="unexpected.js?r=production-release-fixture"></script><script src="app.js?r=production-release-fixture"></script>'), replacement), /unexpected/i);
});

test("release-tokenized URL assertions separate pathname from coherent query validation", () => {
  assert.equal(parsedResource("data/active-packages/pkg/active_package.js?mode=preview&r=release-one#boot", "release-one", false, ["mode"]).pathname, "data/active-packages/pkg/active_package.js");
  assert.throws(() => parsedResource("app.js?r=wrong", "release-one"));
  assert.throws(() => parsedResource("app.js", "release-one"));
  assert.throws(() => parsedResource("app.js?r=release-one&r=release-one", "release-one"));
  assert.throws(() => parsedResource("app.js?r=release-one&r=release-two", "release-one"));
  assert.throws(() => parsedResource("app.js?debug=1&r=release-one", "release-one"));
  assert.equal(parsedResource("app.js?mode=controlled&r=release-one#start", "release-one", false, ["mode"]).pathname, "app.js");
});
