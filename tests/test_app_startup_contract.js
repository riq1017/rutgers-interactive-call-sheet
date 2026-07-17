"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appPath = path.join(__dirname, "..", "app.js");
const appSource = fs.readFileSync(appPath, "utf8");
const { createApplicationStarter, conceptFamily } = require("../app");

test("application starter boots once and returns explicit results", () => {
  let renders = 0;
  const start = createApplicationStarter(() => { renders += 1; });
  assert.equal(start(), "BOOTED");
  assert.equal(start(), "ALREADY_BOOTED");
  assert.equal(renders, 1);
});

test("failed render is not recorded as a successful boot", () => {
  let attempts = 0;
  const start = createApplicationStarter(() => {
    attempts += 1;
    if (attempts === 1) throw new Error("render failed");
  });
  assert.throws(() => start(), /render failed/);
  assert.equal(start(), "BOOTED");
  assert.equal(start(), "ALREADY_BOOTED");
  assert.equal(attempts, 2);
});

function evaluateStartupFooter(mode) {
  const footer = appSource.slice(appSource.indexOf("function createApplicationStarter"), appSource.indexOf('if (typeof module !== "undefined")'));
  const instrumented = footer.replace("const startApplication = createApplicationStarter();", "const startApplication = createApplicationStarter(() => { globalThis.renderCount += 1; });");
  const scope = { document: {}, renderCount: 0 };
  if (mode) scope.CFB27_APP_STARTUP_MODE = mode;
  scope.globalThis = scope;
  vm.createContext(scope);
  vm.runInContext(instrumented, scope);
  return scope;
}

test("default browser mode auto-boots exactly once", () => {
  const scope = evaluateStartupFooter();
  assert.equal(scope.renderCount, 1);
  assert.equal(typeof scope.CFB27_APP_BOOT, "function");
  assert.equal(scope.CFB27_APP_BOOT(), "ALREADY_BOOTED");
  assert.equal(scope.renderCount, 1);
});

test("controlled browser mode exposes boot without auto-booting", () => {
  const scope = evaluateStartupFooter("controlled");
  assert.equal(scope.renderCount, 0);
  assert.equal(typeof scope.CFB27_APP_BOOT, "function");
  assert.equal(scope.CFB27_APP_BOOT(), "BOOTED");
  assert.equal(scope.CFB27_APP_BOOT(), "ALREADY_BOOTED");
  assert.equal(scope.renderCount, 1);
});

test("Node imports remain functional", () => {
  assert.equal(typeof conceptFamily, "function");
  assert.equal(typeof createApplicationStarter, "function");
});

test("preview startup never calls app boot when package validation fails", () => {
  const generator = fs.readFileSync(path.join(__dirname, "..", "tools", "refresh_save_a_preview.js"), "utf8");
  const templateMatch = generator.match(/fs\.writeFileSync\(startupPath, `([\s\S]*?)`, \{ encoding:/);
  assert.ok(templateMatch, "startup template must remain inspectable");
  const startupSource = templateMatch[1].replace(/\\n/g, "\n").replace(/\$\{normalized\.week\}/g, "1").replace(/\$\{normalized\.opponent\.name\}/g, "UMass").replace(/\$\{normalized\.team\.record\}/g, "0-0");
  let bootCalls = 0;
  const scope = {
    CFB27_PACKAGE_RUNTIME: {
      validateActivePackage: () => ({ ok: false, error_code: "MISSING_REQUIRED_ARTIFACT" }),
      renderPackageValidationError: () => true
    },
    CFB27_ACTIVE_PACKAGE_PREFLIGHT: { ok: false },
    CFB27_APP_BOOT: () => { bootCalls += 1; },
    document: { documentElement: { dataset: {} }, getElementById: () => null }
  };
  scope.globalThis = scope;
  vm.createContext(scope);
  vm.runInContext(startupSource, scope);
  assert.equal(bootCalls, 0);
});
