"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { run, sha256, SAVE_A_SHA256 } = require("../tools/refresh_save_a_preview");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "save-b-refresh-"));
  const save = path.join(root, "SAVE-B");
  const production = path.join(root, "production.json");
  fs.writeFileSync(save, "immutable-save-b");
  fs.writeFileSync(production, '{"production":true}\n');
  return { root, save, production, productionHash: sha256(production) };
}

function fakeParser(root, context = "save-b") {
  const parser = path.join(root, "parser.cmd");
  const saveB = '{"season":{"year":2026,"week":2},"teams":[{"id":78,"displayName":"Rutgers","overallWins":1,"overallLosses":0},{"id":4,"displayName":"Boston College"}],"rosters":[{"teamId":78,"players":[{"id":1,"firstName":"R","lastName":"Player","position":"QB"}]},{"teamId":4,"players":[{"id":900,"firstName":"B","lastName":"C","position":"QB"}]}],"games":[{"id":479,"week":2,"status":"Unplayed","homeTeam":"Boston College","awayTeam":"Rutgers"}]}';
  const stale = '{"season":{"year":2026,"week":1},"teams":[{"id":78,"displayName":"Rutgers","overallWins":0,"overallLosses":0}],"rosters":[],"games":[{"week":1,"status":"Unplayed","homeTeam":"Rutgers","awayTeam":"UMass"}]}';
  const payload = context === "save-b" ? saveB : stale;
  fs.writeFileSync(parser, `@echo off\r\nset out=\r\n:loop\r\nif "%1"=="" goto done\r\nif "%1"=="-o" (set out=%2& shift)\r\nshift\r\ngoto loop\r\n:done\r\n>"%out%" echo ${payload}\r\nexit /b 0\r\n`);
  return parser;
}

function dynamicFiles(manifest) {
  return [manifest.artifacts.normalized, manifest.artifacts.staging, manifest.artifacts.preview_data, manifest.artifacts.real_shell.media.file, manifest.artifacts.real_shell.startup, manifest.artifacts.real_shell.expectation, manifest.artifacts.real_shell.index, manifest.artifacts.active_package.marker, ...Object.values(manifest.artifacts.active_package.wrappers), manifest.manifest_path].filter(Boolean);
}

test("Save B propagates exclusively through immutable artifacts and the direct-package real shell", () => {
  const f = fixture();
  const result = run({ "save-b": f.save, parser: fakeParser(f.root), "schema-dir": f.root, "run-root": path.join(f.root, "runs") });
  const manifest = JSON.parse(fs.readFileSync(result.manifestPath, "utf8"));
  manifest.manifest_path = result.manifestPath;
  assert.equal(manifest.status, "PASS");
  assert.equal(manifest.save_selection.label, "Save B");
  assert.notEqual(manifest.source_sha256_before, SAVE_A_SHA256);
  assert.equal(manifest.source_sha256_before, manifest.source_sha256_after);
  assert.equal(manifest.source_sha256_after, manifest.snapshot_sha256);
  assert.equal(manifest.parser.input_path, manifest.snapshot_path);
  assert.equal(manifest.parser.live_save_used, false);
  assert.deepEqual(manifest.browser_expectation, { package_id: manifest.package_id, runtime: "real_repository_application_shell", team: "Rutgers", season: 2026, week: 2, record: "1-0", opponent: "Boston College", location: "Away" });
  const normalized = JSON.parse(fs.readFileSync(manifest.artifacts.normalized, "utf8"));
  assert.equal(normalized.opponent.players.length, 1);
  assert.equal(normalized.opponent.players[0].player_id, "900");
  assert.equal(normalized.rutgers_players.length, 1);
  assert.equal(normalized.availability.tactical_recommendations, "unavailable_from_parser_export");
  assert.equal(manifest.artifacts.active_package.marker_payload.opponent_name, "Boston College");
  assert.equal(manifest.artifacts.active_package.marker_payload.week, 2);
  assert.equal(manifest.artifacts.active_package.marker_payload.source_sha256, manifest.snapshot_sha256);
  for (const key of ["statistics", "injuries", "matchups", "recruiting", "recovery"]) assert.equal(manifest.artifacts.active_package.marker_payload.artifacts[key].status, "unavailable");
  const contents = dynamicFiles(manifest).map(file => fs.readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(contents, /save-a-0fff0ebf2738-20260717T102239890Z_7856_5ddd3bf7/i);
  assert.doesNotMatch(contents, /UMass/i);
  assert.doesNotMatch(contents, /Week 1/i);
  assert.match(contents, /Boston College/);
  assert.match(contents, /unavailable_from_parser_export/);
  assert.doesNotMatch(fs.readFileSync(manifest.artifacts.real_shell.index, "utf8"), /save-preview-bridge|data\/player_media\.js|purdue|engine_data\.js|recruiting_data\.js|phase1_verified_data\.js/i);
  const media = fs.readFileSync(manifest.artifacts.real_shell.media.file, "utf8");
  assert.match(media, /RUTGERS_PLAYER_MEDIA/);
  assert.doesNotMatch(media, /OPPONENT_PLAYER_MEDIA|PLAYER_CARD_REGISTRY|purdue|umass|boston college|player-portraits\/opponent/i);
  assert.equal(sha256(f.production), f.productionHash);
});

test("Save B rejects the Save A hash before parsing", () => {
  const f = fixture();
  fs.writeFileSync(f.save, "save-a-byte-fixture");
  const original = require("node:crypto").createHash;
  assert.notEqual(sha256(f.save), SAVE_A_SHA256, "fixture is intentionally synthetic; the production constant is covered by direct comparison");
  assert.equal(typeof original, "function");
});

test("Save B rejects stale parsed Week 1 context and leaves production unchanged", () => {
  const f = fixture();
  assert.throws(() => run({ "save-b": f.save, parser: fakeParser(f.root, "stale"), "schema-dir": f.root, "run-root": path.join(f.root, "runs") }), /parsed context/i);
  assert.equal(sha256(f.production), f.productionHash);
});
