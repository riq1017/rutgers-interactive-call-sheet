"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { generateActivePackageArtifacts, realShellPreview, sha256 } = require("../tools/refresh_save_a_preview");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "direct-package-preview-"));
  const run = path.join(root, "run-one");
  fs.mkdirSync(run);
  const normalized = { team: { id: 78, name: "Rutgers", record: "1-0" }, season: 2026, week: 2, opponent: { id: 4, name: "Boston College", player_count: 1, players: [{ player_id: "900", name: "BC Player", position: "QB" }] }, location: "Away", rutgers_player_count: 1, rutgers_players: [{ player_id: "1", name: "RU Player", position: "QB" }] };
  const active = generateActivePackageArtifacts(run, normalized, "package-one", "run-one", "a".repeat(64), "b".repeat(64));
  return { run, normalized, active, shell: realShellPreview(run, normalized, "package-one", active) };
}

test("isolated shell uses the direct active package and an allowlist-only startup order", () => {
  const f = fixture();
  const html = fs.readFileSync(f.shell.index, "utf8");
  const sources = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
  assert.equal(sources.filter(src => src.endsWith("active_package.js")).length, 1);
  assert.equal(sources.filter(src => src.endsWith("weekly_manifest.js")).length, 1);
  assert.equal(sources.filter(src => src === "package_runtime.js").length, 1);
  assert.equal(sources.filter(src => src === "app.js").length, 1);
  assert.equal(sources.filter(src => src === "data/player_media.js").length, 0);
  assert.equal(sources.filter(src => src.endsWith("/rutgers_media.js")).length, 1);
  assert.equal(sources.filter(src => /save-preview-bridge/i.test(src)).length, 0);
  for (const forbidden of ["purdue", "engine_data.js", "recruiting_data.js", "phase1_verified_data.js", "purdue_season_stats.js", "purdue_roster.js", "purdue_roster_recovery.js", "weekly/coaching_decisions.js", "weekly/run_lane_analysis.js", "weekly/weekly_matchup_summary.js"]) assert.equal(sources.filter(src => src.toLowerCase().includes(forbidden)).length, 0, forbidden);
  assert.deepEqual(sources, f.shell.script_order);
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
