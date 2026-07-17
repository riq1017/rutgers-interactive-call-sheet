"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const startupPath = path.join(__dirname, "..", "production_startup.js");
const startupSource = fs.readFileSync(startupPath, "utf8");
const { runProductionStartup } = require("../production_startup");

function harness(overrides = {}) {
  const calls = [];
  const nodes = [{ inert: false, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } }];
  const validation = overrides.validation || { ok: true, error_code: null, package_id: "package-one", refresh_id: "refresh-one" };
  const installation = overrides.installation || { ok: true, status: "INSTALLED", error_code: null, package_id: "package-one", refresh_id: "refresh-one" };
  const runtime = {
    validateActivePackage() { calls.push("validate"); if (overrides.validateThrows) throw new Error("validation exploded"); return validation; },
    installActivePackageCompatibilityGlobals(result) { calls.push("install"); assert.equal(result, validation); if (overrides.installThrows) throw new Error("installation exploded"); return installation; },
    renderPackageValidationError(result) { calls.push(["render", result.error_code]); if (overrides.renderThrows) throw new Error("renderer exploded"); return true; }
  };
  const root = {
    CFB27_APP_STARTUP_MODE: "controlled",
    CFB27_PACKAGE_RUNTIME: runtime,
    CFB27_APP_BOOT(approval) { calls.push(["boot", approval]); if (overrides.bootThrows) throw new Error("boot exploded"); return overrides.bootResult || "BOOTED"; },
    document: { documentElement: { dataset: {} }, querySelectorAll: () => nodes }
  };
  Object.assign(root, overrides.root || {});
  return { root, runtime, validation, installation, calls, nodes };
}

test("CommonJS evaluation exports explicit execution without running startup", () => {
  assert.equal(typeof runProductionStartup, "function");
});

test("browser evaluation exposes the API and executes once", () => {
  const h = harness();
  h.root.globalThis = h.root;
  vm.createContext(h.root);
  vm.runInContext(startupSource, h.root);
  assert.equal(typeof h.root.CFB27_PRODUCTION_STARTUP.runProductionStartup, "function");
  assert.deepEqual(h.calls.map(call => Array.isArray(call) ? call[0] : call), ["validate", "install", "boot"]);
  assert.deepEqual([...h.root.CFB27_PRODUCTION_STARTUP_RESULT.sequence], ["VALIDATED", "INSTALLED", "BOOTED"]);
});

test("controlled success validates, installs, approves, and boots in exact order", () => {
  const h = harness();
  const result = runProductionStartup(h.root);
  assert.deepEqual(h.calls.map(call => Array.isArray(call) ? call[0] : call), ["validate", "install", "boot"]);
  assert.equal(h.calls[2][1].startupApproved, true);
  assert.deepEqual([...result.sequence], ["VALIDATED", "INSTALLED", "BOOTED"]);
  assert.deepEqual({ ok: result.ok, status: result.status, error_code: result.error_code, package_id: result.package_id, refresh_id: result.refresh_id }, { ok: true, status: "BOOTED", error_code: null, package_id: "package-one", refresh_id: "refresh-one" });
  assert.equal(h.root.CFB27_PACKAGE_VALIDATION_RESULT, h.validation);
  assert.equal(h.root.CFB27_PACKAGE_INSTALL_RESULT, h.installation);
  assert.equal(h.root.CFB27_APP_BOOT_RESULT, "BOOTED");
});

test("missing controlled mode fails closed and leaves the application inert", () => {
  const h = harness({ root: { CFB27_APP_STARTUP_MODE: undefined } });
  const result = runProductionStartup(h.root);
  assert.equal(result.error_code, "CONTROLLED_MODE_REQUIRED");
  assert.deepEqual(h.calls, [["render", "CONTROLLED_MODE_REQUIRED"]]);
  assert.equal(h.nodes[0].inert, true);
  assert.equal(h.nodes[0].attributes["aria-hidden"], "true");
});

test("missing runtime or app boot API fails closed", () => {
  let h = harness({ root: { CFB27_PACKAGE_RUNTIME: {} } });
  assert.equal(runProductionStartup(h.root).error_code, "RUNTIME_API_MISSING");
  assert.deepEqual(h.calls, []);
  h = harness({ root: { CFB27_APP_BOOT: undefined } });
  assert.equal(runProductionStartup(h.root).error_code, "APP_BOOT_API_MISSING");
  assert.deepEqual(h.calls, [["render", "APP_BOOT_API_MISSING"]]);
});

test("validation failures preserve authoritative errors and never install or boot", () => {
  for (const code of ["STALE_STORED_PACKAGE", "STORED_PACKAGE_NOT_ALLOWED", "INVALID_STORED_PACKAGE", "STORAGE_ACCESS_FAILED", "MISSING_PACKAGE_MARKER", "MISSING_REQUIRED_ARTIFACT"]) {
    const validation = { ok: false, error_code: code, errors: [{ code }], package_id: "package-one", refresh_id: "refresh-one" };
    const h = harness({ validation });
    const result = runProductionStartup(h.root);
    assert.equal(result.error_code, code);
    assert.deepEqual(h.calls, ["validate", ["render", code]]);
    assert.equal(h.root.CFB27_PACKAGE_INSTALL_RESULT, undefined);
    assert.equal(h.root.CFB27_APP_BOOT_RESULT, undefined);
  }
});

test("generic validation failure uses PACKAGE_VALIDATION_FAILED", () => {
  const h = harness({ validation: { ok: false, errors: [] } });
  assert.equal(runProductionStartup(h.root).error_code, "PACKAGE_VALIDATION_FAILED");
});

test("installation failure never boots", () => {
  const h = harness({ installation: { ok: false, status: "INSTALLATION_FAILED", package_id: "package-one", refresh_id: "refresh-one" } });
  const result = runProductionStartup(h.root);
  assert.equal(result.error_code, "PACKAGE_INSTALL_FAILED");
  assert.deepEqual(h.calls, ["validate", "install", ["render", "PACKAGE_INSTALL_FAILED"]]);
  assert.equal(h.root.CFB27_APP_BOOT_RESULT, undefined);
});

test("boot failure is recorded and rendered safely", () => {
  const h = harness({ bootResult: "STARTUP_APPROVAL_REQUIRED" });
  const result = runProductionStartup(h.root);
  assert.equal(result.error_code, "APP_BOOT_FAILED");
  assert.deepEqual([...result.sequence], ["VALIDATED", "INSTALLED"]);
  assert.deepEqual(h.calls.map(call => Array.isArray(call) ? call[0] : call), ["validate", "install", "boot", "render"]);
});

test("thrown startup operations fail closed as STARTUP_EXCEPTION", () => {
  for (const option of ["validateThrows", "installThrows", "bootThrows"]) {
    const h = harness({ [option]: true });
    const result = runProductionStartup(h.root);
    assert.equal(result.error_code, "STARTUP_EXCEPTION");
    assert.equal(result.ok, false);
    assert.equal(h.nodes[0].inert, true);
  }
});

test("optional unavailable artifacts may pass through a successful runtime result", () => {
  const h = harness({ validation: { ok: true, error_code: null, package_id: "package-one", refresh_id: "refresh-one", optional_unavailable: ["statistics", "injuries"] } });
  assert.equal(runProductionStartup(h.root).status, "BOOTED");
});

test("duplicate execution is rejected without repeating or rendering", () => {
  const h = harness();
  const original = runProductionStartup(h.root);
  assert.equal(original.status, "BOOTED");
  const validation = h.root.CFB27_PACKAGE_VALIDATION_RESULT;
  const installation = h.root.CFB27_PACKAGE_INSTALL_RESULT;
  const boot = h.root.CFB27_APP_BOOT_RESULT;
  const callCount = h.calls.length;
  const duplicate = runProductionStartup(h.root);
  assert.equal(duplicate.error_code, "STARTUP_ALREADY_EXECUTED");
  assert.equal(h.calls.length, callCount);
  assert.equal(h.root.CFB27_PRODUCTION_STARTUP_RESULT, original);
  assert.equal(h.root.CFB27_PRODUCTION_STARTUP_LAST_ATTEMPT_RESULT, duplicate);
  assert.equal(h.root.CFB27_PACKAGE_VALIDATION_RESULT, validation);
  assert.equal(h.root.CFB27_PACKAGE_INSTALL_RESULT, installation);
  assert.equal(h.root.CFB27_APP_BOOT_RESULT, boot);
  assert.deepEqual([...h.root.CFB27_PRODUCTION_STARTUP_RESULT.sequence], ["VALIDATED", "INSTALLED", "BOOTED"]);
});

test("controller never accesses or mutates storage directly", () => {
  assert.doesNotMatch(startupSource, /localStorage|sessionStorage|removeItem|setItem|getItem|JSON\.parse/);
  const h = harness();
  h.root.localStorage = new Proxy({}, { get() { throw new Error("controller touched storage"); } });
  assert.equal(runProductionStartup(h.root).status, "BOOTED");
});

test("fatal renderer receives deterministic validation diagnostics", () => {
  const validation = { ok: false, error_code: "MISSING_PACKAGE_MARKER", errors: [{ code: "MISSING_PACKAGE_MARKER" }], package_id: null, refresh_id: null };
  const h = harness({ validation });
  runProductionStartup(h.root);
  assert.deepEqual(h.calls, ["validate", ["render", "MISSING_PACKAGE_MARKER"]]);
  assert.equal(h.root.document.documentElement.dataset.startupStatus, "blocked");
});
