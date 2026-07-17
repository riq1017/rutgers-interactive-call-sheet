"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function evaluate(mode, values = {}) {
  const calls = [];
  const scope = { console, localStorage: {
    getItem(key) { calls.push(["get", key]); return values[key] ?? null; },
    setItem(key, value) { calls.push(["set", key, value]); values[key] = value; },
    removeItem(key) { calls.push(["remove", key]); delete values[key]; }
  } };
  if (mode) scope.CFB27_APP_STARTUP_MODE = mode;
  scope.globalThis = scope;
  vm.createContext(scope);
  vm.runInContext(appSource, scope);
  return { calls, scope, values };
}

test("controlled evaluation performs no package-storage operations or migrations", () => {
  assert.deepEqual(evaluate("controlled").calls, []);
});

test("default evaluation preserves the legacy package-cache reset", () => {
  assert.deepEqual(evaluate().calls.slice(0, 5), [
    ["get", "rutgers_app_data_version"],
    ["remove", "rutgers_weekly_package"],
    ["remove", "rutgers_gameplan_weekly_v2"],
    ["remove", "rutgers_recruiting_weekly_v2"],
    ["set", "rutgers_app_data_version", "week1_umass_save_20260717_v3"]
  ]);
});

test("unapproved controlled boot leaves stale, same-ID, and malformed packages byte-for-byte unchanged", () => {
  for (const raw of ['{"package_id":"stale"}', '{"package_id":"same-id"}', "{malformed"]) {
    const values = {
      rutgers_weekly_package: raw,
      rutgers_gameplan_weekly_v2: raw,
      rutgers_recruiting_weekly_v2: raw
    };
    const before = { ...values };
    const evaluated = evaluate("controlled", values);
    assert.equal(evaluated.scope.CFB27_APP_BOOT(), "STARTUP_APPROVAL_REQUIRED");
    assert.deepEqual(evaluated.calls, []);
    assert.deepEqual(values, before);
  }
});

test("controlled evaluation and unapproved boot tolerate inaccessible storage without touching it", () => {
  const scope = { console, CFB27_APP_STARTUP_MODE: "controlled" };
  scope.localStorage = new Proxy({}, { get() { throw new Error("inaccessible"); } });
  scope.globalThis = scope;
  vm.createContext(scope);
  assert.doesNotThrow(() => vm.runInContext(appSource, scope));
  assert.equal(scope.CFB27_APP_BOOT(), "STARTUP_APPROVAL_REQUIRED");
});

test("controlled package initialization does not access storage", () => {
  const oldMode = globalThis.CFB27_APP_STARTUP_MODE;
  const oldStorage = globalThis.localStorage;
  globalThis.CFB27_APP_STARTUP_MODE = "controlled";
  globalThis.localStorage = new Proxy({}, { get() { throw new Error("storage must not be accessed"); } });
  try {
    const app = require("../app");
    assert.equal(app.initializePackageSourcesForBoot(), "COMPATIBILITY_GLOBALS_ONLY");
    assert.deepEqual(app.loadHistory(), []);
    assert.deepEqual(app.loadRecentCalls(), []);
    assert.deepEqual([...app.favoritePlayIds()], []);
  } finally {
    if (oldMode === undefined) delete globalThis.CFB27_APP_STARTUP_MODE; else globalThis.CFB27_APP_STARTUP_MODE = oldMode;
    if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage;
  }
});

test("controlled gameplan and recruiting imports reject before reading files", () => {
  const oldMode = globalThis.CFB27_APP_STARTUP_MODE;
  const oldDocument = globalThis.document;
  const oldReader = globalThis.FileReader;
  globalThis.CFB27_APP_STARTUP_MODE = "controlled";
  globalThis.document = { getElementById: () => null };
  globalThis.FileReader = class { constructor() { throw new Error("FileReader must not be created"); } };
  try {
    const { importEnginePackage } = require("../app");
    assert.equal(importEnginePackage({ name: "gameplan.json" }, "gameplan"), "IMPORT_DISABLED");
    assert.equal(importEnginePackage({ name: "recruiting.json" }, "recruiting"), "IMPORT_DISABLED");
  } finally {
    if (oldMode === undefined) delete globalThis.CFB27_APP_STARTUP_MODE; else globalThis.CFB27_APP_STARTUP_MODE = oldMode;
    if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
    if (oldReader === undefined) delete globalThis.FileReader; else globalThis.FileReader = oldReader;
  }
});

test("controlled import controls are rendered disabled", () => {
  assert.equal((appSource.match(/id="importGameplanWeekly"[^>]*\$\{importDisabled\}/g) || []).length, 2);
  assert.equal((appSource.match(/id="importRecruitingWeekly"[^>]*\$\{importDisabled\}/g) || []).length, 2);
  assert.match(appSource, /disabled aria-disabled="true"/);
});
