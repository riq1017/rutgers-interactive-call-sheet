"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { run, sha256 } = require("../tools/refresh_save_a_preview");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "save-a-refresh-"));
  const save = path.join(root, "SAVE-A");
  const production = path.join(root, "production.json");
  fs.writeFileSync(save, "immutable-save-a");
  fs.writeFileSync(production, '{"production":true}\n');
  return { root, save, production, productionHash: sha256(production) };
}

function fakeParser(root, shouldFail = false) {
  const parser = path.join(root, "parser.cmd");
  const script = shouldFail
    ? "@echo off\r\nexit /b 9\r\n"
    : "@echo off\r\nset out=\r\n:loop\r\nif \"%1\"==\"\" goto done\r\nif \"%1\"==\"-o\" (set out=%2& shift)\r\nshift\r\ngoto loop\r\n:done\r\n>\"%out%\" echo {\"season\":{\"year\":2026},\"teams\":[{\"id\":78,\"displayName\":\"Rutgers\"}],\"rosters\":[{\"teamId\":78,\"players\":[{}]}],\"games\":[{\"week\":1,\"status\":\"Unplayed\",\"homeTeam\":\"Rutgers\",\"awayTeam\":\"UMass\"}]}\r\nexit /b 0\r\n";
  fs.writeFileSync(parser, script);
  return parser;
}

test("successful Save A refresh is snapshot-only, lineage-complete, and production-safe", () => {
  const f = fixture();
  const result = run({ "save-a": f.save, parser: fakeParser(f.root), "schema-dir": f.root, "run-root": path.join(f.root, "runs") });
  const manifest = JSON.parse(fs.readFileSync(result.manifestPath, "utf8"));
  assert.equal(manifest.status, "PASS");
  assert.equal(manifest.save_selection.label, "Save A");
  assert.equal(manifest.source_sha256_before, manifest.source_sha256_after);
  assert.equal(manifest.source_sha256_after, manifest.snapshot_sha256);
  assert.equal(manifest.parser.input_path, manifest.snapshot_path);
  assert.equal(manifest.parser.live_save_used, false);
  for (const artifact of [manifest.artifacts.normalized, manifest.artifacts.staging, manifest.artifacts.preview_data]) {
    const payload = JSON.parse(fs.readFileSync(artifact, "utf8"));
    assert.equal(payload.lineage.save_sha256, manifest.source_sha256_before);
    assert.equal(payload.package_id || payload.lineage.package_id, manifest.package_id);
  }
  assert.equal(sha256(f.production), f.productionHash);
  assert.equal(manifest.production_changed, false);
  assert.equal(manifest.browser_expectation.runtime, "real_repository_application_shell");
  assert.ok(fs.existsSync(manifest.artifacts.real_shell.index));
  assert.ok(fs.existsSync(manifest.artifacts.real_shell.bridge));
  assert.match(fs.readFileSync(manifest.artifacts.real_shell.index, "utf8"), /app\.js\?preview=/);
});

test("failed parser check writes FAIL manifest and leaves production unchanged", () => {
  const f = fixture();
  let failure;
  assert.throws(() => run({ "save-a": f.save, parser: fakeParser(f.root, true), "schema-dir": f.root, "run-root": path.join(f.root, "runs") }), (error) => { failure = error; return /External parser failed/.test(error.message); });
  const manifest = JSON.parse(fs.readFileSync(failure.manifestPath, "utf8"));
  assert.equal(manifest.status, "FAIL");
  assert.equal(manifest.production_write_attempted, false);
  assert.equal(manifest.production_changed, false);
  assert.equal(sha256(f.production), f.productionHash);
});

test("Save A selection is mandatory", () => {
  const f = fixture();
  assert.throws(() => run({ parser: fakeParser(f.root), "run-root": path.join(f.root, "runs") }), /save must be explicitly selected/i);
});

test("selecting both saves is rejected", () => {
  const f = fixture();
  const { parseArgs } = require("../tools/refresh_save_a_preview");
  assert.throws(() => parseArgs(["--save-a", f.save, "--save-b", f.save]), /exactly one/i);
});
