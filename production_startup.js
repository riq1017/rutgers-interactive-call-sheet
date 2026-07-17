"use strict";

(function exposeProductionStartup(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CFB27_PRODUCTION_STARTUP = Object.freeze(api);
  if (root && typeof module === "undefined") api.runProductionStartup(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function productionStartupFactory() {
  const EXECUTION_SENTINEL = "CFB27_PRODUCTION_STARTUP_EXECUTED";

  function freezeResult(value) {
    return Object.freeze({
      ok: value.ok === true,
      status: value.status,
      error_code: value.error_code || null,
      package_id: value.package_id || null,
      refresh_id: value.refresh_id || null,
      sequence: Object.freeze([...(value.sequence || [])])
    });
  }

  function contextOf(value) {
    return {
      package_id: value && value.package_id || null,
      refresh_id: value && value.refresh_id || null
    };
  }

  function markApplicationInert(scope) {
    const doc = scope && scope.document;
    if (!doc) return;
    if (doc.documentElement && doc.documentElement.dataset) doc.documentElement.dataset.startupStatus = "blocked";
    if (typeof doc.querySelectorAll !== "function") return;
    for (const node of doc.querySelectorAll("[data-tab], .tab, #app, #application")) {
      node.inert = true;
      if (typeof node.setAttribute === "function") node.setAttribute("aria-hidden", "true");
    }
  }

  function safeRender(runtime, failure, scope) {
    markApplicationInert(scope);
    if (!runtime || typeof runtime.renderPackageValidationError !== "function") return false;
    try { return runtime.renderPackageValidationError(failure, scope.document) === true; }
    catch (_) { return false; }
  }

  function recordFailure(scope, runtime, errorCode, sequence, source) {
    const context = contextOf(source);
    const failure = Object.freeze({
      ok: false,
      error_code: errorCode,
      errors: source && Array.isArray(source.errors) ? source.errors : [],
      package_id: context.package_id,
      refresh_id: context.refresh_id
    });
    safeRender(runtime, failure, scope);
    const result = freezeResult({ ok: false, status: "BLOCKED", error_code: errorCode, ...context, sequence });
    scope.CFB27_PRODUCTION_STARTUP_RESULT = result;
    return result;
  }

  function runProductionStartup(scope = globalThis) {
    if (scope[EXECUTION_SENTINEL]) {
      const prior = scope.CFB27_PRODUCTION_STARTUP_RESULT;
      const duplicate = freezeResult({
        ok: false,
        status: "REJECTED",
        error_code: "STARTUP_ALREADY_EXECUTED",
        ...contextOf(prior),
        sequence: prior && prior.sequence || []
      });
      scope.CFB27_PRODUCTION_STARTUP_LAST_ATTEMPT_RESULT = duplicate;
      return duplicate;
    }
    scope[EXECUTION_SENTINEL] = true;

    const sequence = [];
    const runtime = scope.CFB27_PACKAGE_RUNTIME;
    try {
      if (scope.CFB27_APP_STARTUP_MODE !== "controlled") {
        return recordFailure(scope, runtime, "CONTROLLED_MODE_REQUIRED", sequence, null);
      }

      const runtimeReady = runtime
        && typeof runtime.validateActivePackage === "function"
        && typeof runtime.installActivePackageCompatibilityGlobals === "function"
        && typeof runtime.renderPackageValidationError === "function";
      if (!runtimeReady) return recordFailure(scope, runtime, "RUNTIME_API_MISSING", sequence, null);
      if (typeof scope.CFB27_APP_BOOT !== "function") return recordFailure(scope, runtime, "APP_BOOT_API_MISSING", sequence, null);

      const validation = runtime.validateActivePackage(scope);
      scope.CFB27_PACKAGE_VALIDATION_RESULT = validation;
      if (!validation || validation.ok !== true) {
        return recordFailure(scope, runtime, validation && validation.error_code || "PACKAGE_VALIDATION_FAILED", sequence, validation);
      }
      sequence.push("VALIDATED");

      const installation = runtime.installActivePackageCompatibilityGlobals(validation, scope);
      scope.CFB27_PACKAGE_INSTALL_RESULT = installation;
      if (!installation || installation.ok !== true || installation.status !== "INSTALLED") {
        return recordFailure(scope, runtime, installation && installation.error_code || "PACKAGE_INSTALL_FAILED", sequence, installation || validation);
      }
      sequence.push("INSTALLED");

      const bootResult = scope.CFB27_APP_BOOT({ startupApproved: true });
      scope.CFB27_APP_BOOT_RESULT = bootResult;
      if (bootResult !== "BOOTED") return recordFailure(scope, runtime, "APP_BOOT_FAILED", sequence, installation);
      sequence.push("BOOTED");

      const result = freezeResult({ ok: true, status: "BOOTED", error_code: null, ...contextOf(validation), sequence });
      scope.CFB27_PRODUCTION_STARTUP_RESULT = result;
      if (scope.document && scope.document.documentElement && scope.document.documentElement.dataset) scope.document.documentElement.dataset.startupStatus = "booted";
      return result;
    } catch (_) {
      return recordFailure(scope, runtime, "STARTUP_EXCEPTION", sequence, scope.CFB27_PACKAGE_INSTALL_RESULT || scope.CFB27_PACKAGE_VALIDATION_RESULT || null);
    }
  }

  return Object.freeze({ runProductionStartup });
});
