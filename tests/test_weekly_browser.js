"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { args, expected, pagesRepository, simulation, startupPassed, storageAttackRejected } = require("../tools/validate_weekly_browser");

const wanted = { team: "Rutgers", season: 2026, week: 3, record: "2-0", opponent: "Neutral Opponent", location: "Home", package_id: "pkg", refresh_id: "refresh", release_id: "release", commit: "abc" };
const passing = { ...wanted, http_status: 200, startup: ["VALIDATED", "INSTALLED", "BOOTED"], active_packages: 1, legacy_resources: false, console_errors: false, clean_reload: true, warm_reload: true, mobile: true, storage_override_rejected: true };

function fixture(value) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "weekly-browser-"));
  const file = path.join(dir, "fixture.json"); fs.writeFileSync(file, JSON.stringify(value));
  return { dir, file };
}

test("successful browser and publish simulation passes", () => {
  const f = fixture(passing);
  try { assert.equal(simulation(f.file, wanted).status, "PASS"); } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

for (const [name, change, message] of [
  ["candidate browser failure", { console_errors: true }, /console gate/],
  ["stored package override attempt", { storage_override_rejected: false }, /storage gate/],
  ["hosted deployment mismatch", { commit: "different" }, /commit mismatch/],
  ["hosted context mismatch", { opponent: "Wrong" }, /context mismatch/],
  ["legacy resource reintroduction", { legacy_resources: true }, /resource or console/],
  ["multiple active packages", { active_packages: 2 }, /resource or console/],
  ["clean cache failure", { clean_reload: false }, /reload/],
  ["warm cache failure", { warm_reload: false }, /reload/],
  ["mobile failure", { mobile: false }, /mobile/]
]) test(`${name} fails closed`, () => {
  const f = fixture({ ...passing, ...change });
  try { assert.throws(() => simulation(f.file, wanted), message); } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test("CLI requires exactly named inputs", () => {
  assert.deepEqual(args(["--simulation", "proof.json"]), { simulation: "proof.json" });
  assert.throws(() => args([]), /required/);
});

test("hosted URL deterministically identifies the Pages repository", () => {
  assert.equal(pagesRepository("https://riq1017.github.io/rutgers-interactive-call-sheet/"), "riq1017/rutgers-interactive-call-sheet");
  assert.throws(() => pagesRepository("https://example.com/site"), /does not identify/);
});

test("nested preview expectation is normalized into exact DOM and context values", () => {
  const f = fixture({ package_id: "pkg", refresh_id: "refresh", expected_dom: { weekOpponent: "Week 4 vs FCS East", seasonRecord: "1-2" }, context: { team: "Rutgers", season: 2026, week: 4, opponent: "FCS East", location: "Home" } });
  try {
    const value = expected(f.file);
    assert.equal(value.week, 4);
    assert.equal(value.opponent, "FCS East");
    assert.equal(value.record, "1-2");
    assert.deepEqual(value.expected_dom, { weekOpponent: "Week 4 vs FCS East", seasonRecord: "1-2" });
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test("startup proof requires the exact three-stage sequence", () => {
  assert.equal(startupPassed(["VALIDATED", "INSTALLED", "BOOTED"]), true);
  assert.equal(startupPassed(["VALIDATED", "BOOTED"]), false);
  assert.equal(startupPassed(["VALIDATED", "INSTALLED", "BOOTED", "EXTRA"]), false);
});

test("stored-package attack must fail closed without rendering stored context", () => {
  assert.equal(storageAttackRejected({ validationOk: false, errorCode: "STALE_STORED_PACKAGE", text: "Startup blocked" }), true);
  assert.equal(storageAttackRejected({ validationOk: true, errorCode: null, text: "Stored Stale Opponent" }), false);
  assert.equal(storageAttackRejected({ validationOk: false, errorCode: "STALE_STORED_PACKAGE", text: "Stored Stale Opponent" }), false);
});
