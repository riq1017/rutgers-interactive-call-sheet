"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { generateActivePackageArtifacts, sha256, sha256Text } = require("../tools/refresh_save_a_preview");
const { validateActivePackage } = require("../package_runtime");
const runtimeSource = fs.readFileSync(path.join(__dirname, "..", "package_runtime.js"), "utf8");

const HASH = "a".repeat(64);
function normalized() {
  return { team: { id: 78, name: "Rutgers", record: "1-0" }, season: 2026, week: 2, opponent: { id: 4, name: "Boston College", player_count: 1, players: [{ player_id: "900", name: "B C", position: "QB" }] }, location: "Away", rutgers_player_count: 1, rutgers_players: [{ player_id: "1", name: "R Player", position: "QB" }] };
}

function generated() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "active-package-contract-"));
  const normalizedFile = path.join(root, "normalized.json");
  fs.writeFileSync(normalizedFile, `${JSON.stringify(normalized())}\n`);
  const artifacts = generateActivePackageArtifacts(root, normalized(), "package-one", "refresh-one", HASH, sha256(normalizedFile));
  return { root, artifacts };
}

function loadGenerated(artifacts) {
  const scope = { console };
  scope.globalThis = scope;
  vm.createContext(scope);
  vm.runInContext(fs.readFileSync(artifacts.marker, "utf8"), scope);
  for (const file of Object.values(artifacts.wrappers)) vm.runInContext(fs.readFileSync(file, "utf8"), scope);
  return scope;
}

test("active-package schema declares the complete lineage and artifact contract", () => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "contracts", "active_package.schema.json"), "utf8"));
  for (const field of ["package_id", "refresh_id", "source_sha256", "snapshot_sha256", "normalized_sha256", "team_id", "season", "week", "opponent_id", "opponent_name", "artifacts"]) assert.ok(schema.required.includes(field));
  assert.equal(schema.properties.schema_version.const, "cfb27_active_package_v1");
  assert.equal(schema.$defs.sha256.pattern, "^[a-f0-9]{64}$");
});

test("runtime module evaluation only exposes the explicit API", () => {
  let bootCalls = 0;
  let rendered = 0;
  const scope = {
    document: { body: { replaceChildren: () => { rendered += 1; } } },
    CFB27_APP_BOOT: () => { bootCalls += 1; }
  };
  scope.globalThis = scope;
  vm.createContext(scope);
  vm.runInContext(runtimeSource, scope);
  assert.equal(typeof scope.CFB27_PACKAGE_RUNTIME.validateActivePackage, "function");
  assert.equal(typeof scope.CFB27_PACKAGE_RUNTIME.installActivePackageCompatibilityGlobals, "function");
  assert.equal(typeof scope.CFB27_PACKAGE_RUNTIME.renderPackageValidationError, "function");
  assert.equal(scope.CFB27_ACTIVE_PACKAGE_PREFLIGHT, undefined);
  assert.equal(scope.WEEKLY_PLAN, undefined);
  assert.equal(scope.GAMEPLAN_WEEKLY, undefined);
  assert.equal(scope.RUTGERS_ROSTER_BASE, undefined);
  assert.equal(bootCalls, 0);
  assert.equal(rendered, 0);
});

test("generator emits deterministic neutral wrappers with one package and verified hashes", () => {
  const first = generated();
  const secondRoot = fs.mkdtempSync(path.join(os.tmpdir(), "active-package-determinism-"));
  const second = generateActivePackageArtifacts(secondRoot, normalized(), "package-one", "refresh-one", HASH, first.artifacts.marker_payload.normalized_sha256);
  assert.deepEqual(Object.keys(first.artifacts.wrappers), Object.keys(second.wrappers));
  for (const key of Object.keys(first.artifacts.wrappers)) {
    const one = fs.readFileSync(first.artifacts.wrappers[key], "utf8");
    const two = fs.readFileSync(second.wrappers[key], "utf8");
    assert.equal(one, two);
    assert.equal(sha256Text(one), first.artifacts.marker_payload.artifacts[key].sha256);
    assert.doesNotMatch(one, /data[\\/]engine_data|phase1_verified_data|purdue_roster\.js/i);
  }
  const scope = loadGenerated(first.artifacts);
  assert.deepEqual([...new Set(Object.values(scope.ACTIVE_PACKAGE_ARTIFACTS).map(item => item.package_id))], ["package-one"]);
  const result = validateActivePackage(scope, { storage: null });
  assert.deepEqual({ ok: result.ok, error_code: result.error_code, package_id: result.package_id, refresh_id: result.refresh_id }, { ok: true, error_code: null, package_id: "package-one", refresh_id: "refresh-one" });
  assert.equal(scope.WEEKLY_PLAN, undefined);
});

test("optional unavailable domains contain no payload and may remain absent", () => {
  const { artifacts } = generated();
  const scope = loadGenerated(artifacts);
  for (const key of ["statistics", "injuries", "matchups", "recruiting", "recovery"]) {
    assert.equal(scope.ACTIVE_PACKAGE_ARTIFACTS[key].status, "unavailable");
    assert.equal(scope.ACTIVE_PACKAGE_ARTIFACTS[key].payload, null);
    delete scope.ACTIVE_PACKAGE_ARTIFACTS[key];
  }
  assert.equal(validateActivePackage(scope, { storage: null }).ok, true);
});

test("validator fails closed for missing, conflicting, duplicate, stale, and inconsistent packages", () => {
  assert.equal(validateActivePackage({}, { storage: null }).error_code, "MISSING_PACKAGE_MARKER");
  const { artifacts } = generated();
  let scope = loadGenerated(artifacts);
  scope.ACTIVE_PACKAGE_ARTIFACTS.weekly_plan = { ...scope.ACTIVE_PACKAGE_ARTIFACTS.weekly_plan, package_id: "other-package" };
  assert.equal(validateActivePackage(scope, { storage: null }).ok, false);
  assert.ok(validateActivePackage(scope, { storage: null }).errors.some(error => error.code === "CONFLICTING_OR_DUPLICATE_PACKAGE"));

  scope = loadGenerated(artifacts);
  assert.equal(validateActivePackage(scope, { storage: null, observedPackages: ["stale-package"] }).error_code, "CONFLICTING_OR_DUPLICATE_PACKAGE");
  assert.equal(validateActivePackage(scope, { storage: null, observedPackages: ["package-one", "package-one"] }).error_code, "DUPLICATE_PACKAGE_ID");
  const storage = { getItem: key => key === "rutgers_weekly_package" ? JSON.stringify({ package_id: "stale-package" }) : null };
  assert.ok(validateActivePackage(scope, { storage }).errors.some(error => error.code === "STALE_STORED_PACKAGE"));
  scope.ACTIVE_PACKAGE_MANIFEST = { ...scope.ACTIVE_PACKAGE_MANIFEST, week: 3 };
  assert.ok(validateActivePackage(scope, { storage: null }).errors.some(error => error.code === "PACKAGE_CONTEXT_MISMATCH"));
});

test("required wrappers and matching-ID payload mismatches fail closed while unavailable optional wrappers may be absent", () => {
  const { artifacts } = generated();
  let scope = loadGenerated(artifacts);
  delete scope.ACTIVE_PACKAGE_ARTIFACTS.weekly_plan;
  assert.ok(validateActivePackage(scope, { storage: null }).errors.some(error => error.code === "MISSING_REQUIRED_ARTIFACT"));
  assert.equal(scope.WEEKLY_PLAN, undefined);
  scope = loadGenerated(artifacts);
  scope.ACTIVE_PACKAGE_ARTIFACTS.gameplan_weekly = { ...scope.ACTIVE_PACKAGE_ARTIFACTS.gameplan_weekly, payload: { ...scope.ACTIVE_PACKAGE_ARTIFACTS.gameplan_weekly.payload, record: "0-0" } };
  assert.ok(validateActivePackage(scope, { storage: null }).errors.some(error => error.code === "PACKAGE_PAYLOAD_CONTEXT_MISMATCH"));
  assert.equal(scope.GAMEPLAN_WEEKLY, undefined);
  scope = loadGenerated(artifacts);
  delete scope.ACTIVE_PACKAGE_ARTIFACTS.statistics;
  assert.equal(validateActivePackage(scope, { storage: null }).ok, true);
  scope.RUTGERS_PLAYBOOK = Array.from({ length: 12 }, (_, index) => ({ id: `play-${index}` }));
  const validation = validateActivePackage(scope, { storage: null });
  const installation = require("../package_runtime").installActivePackageCompatibilityGlobals(validation, scope);
  assert.equal(installation.status, "INSTALLED");
  assert.equal(scope.WEEKLY_PLAN.package_id, "package-one");
  assert.equal(require("../package_runtime").installActivePackageCompatibilityGlobals(validation, scope).status, "ALREADY_INSTALLED");
});

test("stale local storage fails before compatibility globals can replace the active package", () => {
  const { artifacts } = generated();
  const scope = loadGenerated(artifacts);
  scope.RUTGERS_PLAYBOOK = Array.from({ length: 12 }, (_, index) => ({ id: `play-${index}` }));
  const storage = { getItem: key => key === "rutgers_weekly_package" ? JSON.stringify({ package_id: "stale-package", opponent: "Stale" }) : null };
  const result = validateActivePackage(scope, { storage });
  assert.equal(result.ok, false);
  assert.equal(require("../package_runtime").installActivePackageCompatibilityGlobals(result, scope).status, "VALIDATION_FAILED");
  assert.equal(scope.WEEKLY_PLAN, undefined);
  assert.equal(scope.GAMEPLAN_WEEKLY, undefined);
  const sameIdScope = loadGenerated(artifacts);
  sameIdScope.RUTGERS_PLAYBOOK = scope.RUTGERS_PLAYBOOK;
  const sameIdStorage = { getItem: key => key === "rutgers_weekly_package" ? JSON.stringify({ package_id: "package-one", opponent: "Injected" }) : null };
  const sameIdResult = validateActivePackage(sameIdScope, { storage: sameIdStorage });
  assert.equal(sameIdResult.ok, false);
  assert.ok(sameIdResult.errors.some(error => error.code === "STORED_PACKAGE_NOT_ALLOWED"));
  assert.equal(sameIdScope.WEEKLY_PLAN, undefined);
});

test("compatibility installation requires the exact successful validation result", () => {
  const { artifacts } = generated();
  const scope = loadGenerated(artifacts);
  scope.RUTGERS_PLAYBOOK = Array.from({ length: 12 }, (_, index) => ({ id: `play-${index}` }));
  const runtime = require("../package_runtime");
  assert.equal(runtime.installActivePackageCompatibilityGlobals(null, scope).status, "VALIDATION_REQUIRED");
  assert.equal(runtime.installActivePackageCompatibilityGlobals({ ok: true, package_id: "package-one", refresh_id: "refresh-one" }, scope).status, "VALIDATION_REQUIRED");
  assert.equal(scope.WEEKLY_PLAN, undefined);
  const validation = runtime.validateActivePackage(scope, { storage: null });
  assert.equal(runtime.installActivePackageCompatibilityGlobals(validation, scope).status, "INSTALLED");
  assert.deepEqual(runtime.COMPATIBILITY_GLOBALS, ["WEEKLY_PLAN", "GAMEPLAN_WEEKLY", "RUTGERS_ROSTER_BASE"]);
  for (const forbidden of ["OPPONENT_DATA", "PURDUE_MATCHUPS", "VIDEO_VERIFIED_PURDUE_ROSTER", "RECRUITING_WEEKLY", "PLAYER_MATCHUPS"]) assert.equal(scope[forbidden], undefined);
});

test("undeclared save-managed globals fail validation", () => {
  const { artifacts } = generated();
  const scope = loadGenerated(artifacts);
  scope.PURDUE_MATCHUPS = {};
  const result = validateActivePackage(scope, { storage: null });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === "UNDECLARED_SAVE_MANAGED_GLOBAL" && error.detail === "PURDUE_MATCHUPS"));
});

test("generic defensive legacy-global detection rejects Purdue and UMass state", () => {
  for (const forbidden of ["PURDUE_MATCHUPS", "VIDEO_VERIFIED_UMASS_ROSTER"]) {
    const { artifacts } = generated();
    const scope = loadGenerated(artifacts);
    scope[forbidden] = {};
    const result = validateActivePackage(scope, { storage: null });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.code === "UNDECLARED_SAVE_MANAGED_GLOBAL" && error.detail === forbidden));
  }
});

test("failure renderer uses the approved fatal message and does not boot or install", () => {
  let bootCalls = 0;
  const body = { child: null, replaceChildren(node) { this.child = node; } };
  const doc = { body, createElement: () => ({ dataset: {}, setAttribute() {} }) };
  const scope = { CFB27_APP_BOOT: () => { bootCalls += 1; } };
  const runtime = require("../package_runtime");
  const failure = { ok: false, error_code: "MISSING_PACKAGE_MARKER", errors: [], package_id: null, refresh_id: null };
  assert.equal(runtime.renderPackageValidationError(failure, doc), true);
  assert.equal(body.child.textContent, "Startup blocked: active package validation failed (MISSING_PACKAGE_MARKER). No dynasty package was loaded. Reload after the approved deployment completes.");
  assert.equal(body.child.dataset.errorCode, "MISSING_PACKAGE_MARKER");
  assert.equal(scope.WEEKLY_PLAN, undefined);
  assert.equal(bootCalls, 0);
});

test("executing the same wrapper twice is rejected as a duplicate declaration", () => {
  const { artifacts } = generated();
  const scope = { console };
  scope.globalThis = scope;
  vm.createContext(scope);
  const script = fs.readFileSync(artifacts.wrappers.weekly_plan, "utf8");
  vm.runInContext(script, scope);
  assert.throws(() => vm.runInContext(script, scope), /Duplicate active-package artifact/);
});
