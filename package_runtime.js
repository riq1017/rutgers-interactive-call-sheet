"use strict";

(function exposePackageRuntime(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.CFB27_PACKAGE_RUNTIME = Object.freeze(api);
})(typeof globalThis !== "undefined" ? globalThis : this, function packageRuntimeFactory() {
  const SHA256 = /^[a-f0-9]{64}$/;
  const REQUIRED_MARKER_FIELDS = ["package_id", "refresh_id", "source_sha256", "snapshot_sha256", "normalized_sha256", "team_id", "season", "week", "opponent_id", "opponent_name"];
  const STORAGE_KEYS = ["rutgers_weekly_package", "rutgers_gameplan_weekly_v2", "rutgers_recruiting_weekly_v2"];
  const SAVE_MANAGED_GLOBALS = ["WEEKLY_PLAN", "GAMEPLAN_WEEKLY", "RUTGERS_ROSTER_BASE", "OPPONENT_DATA", "OPPONENT_LAST_GAME_STATS", "OPPONENT_SEASON_STATS", "OPPONENT_PLAYER_MEDIA", "PLAYER_MATCHUPS", "WEEKLY_COACHING_DECISIONS", "WEEKLY_RUN_LANE_ANALYSIS", "WEEKLY_MATCHUP_SUMMARY", "RECRUITING_WEEKLY", "RECRUITING_BOARD", "RECRUITING_CLASS", "RECRUITING_PERFORMANCE", "RECRUITING_SETTINGS", "RECRUITS_DATA", "TEAM_NEEDS_DATA", "TEAM_NEEDS_ENRICHED", "RUTGERS_LAST_GAME_STATS", "RUTGERS_SEASON_STATS"];
  const FORBIDDEN_LEGACY_GLOBAL = /^(?:(?:PURDUE|UMASS)_|VIDEO_VERIFIED_(?:PURDUE|UMASS)_)/i;
  const COMPATIBILITY_GLOBALS = Object.freeze(["WEEKLY_PLAN", "GAMEPLAN_WEEKLY", "RUTGERS_ROSTER_BASE"]);
  const successfulValidations = new WeakMap();
  const installedScopes = new WeakMap();

  function contextOf(value = {}) {
    return {
      team_id: String(value.team_id ?? ""), season: Number(value.season), week: Number(value.week),
      opponent_id: String(value.opponent_id ?? ""), opponent_name: String(value.opponent_name ?? "")
    };
  }

  function validateActivePackage(scope = globalThis, options = {}) {
    const errors = [];
    const marker = scope && scope.ACTIVE_DYNASTY_PACKAGE;
    const manifest = scope && scope.ACTIVE_PACKAGE_MANIFEST;
    const artifacts = scope && scope.ACTIVE_PACKAGE_ARTIFACTS;
    const fail = (code, detail) => errors.push({ code, detail });
    if (!marker || typeof marker !== "object") fail("MISSING_PACKAGE_MARKER", "ACTIVE_DYNASTY_PACKAGE is required");
    if (!manifest || typeof manifest !== "object") fail("MISSING_PACKAGE_MANIFEST", "ACTIVE_PACKAGE_MANIFEST is required");
    if (!artifacts || typeof artifacts !== "object" || Array.isArray(artifacts)) fail("MISSING_ARTIFACT_REGISTRY", "ACTIVE_PACKAGE_ARTIFACTS is required");
    if (errors.length) return { ok: false, error_code: errors[0].code, errors, package_id: null, refresh_id: null };

    if (marker.schema_version !== "cfb27_active_package_v1") fail("INVALID_MARKER_SCHEMA", marker.schema_version);
    for (const field of REQUIRED_MARKER_FIELDS) if (marker[field] === undefined || marker[field] === null || marker[field] === "") fail("MISSING_MARKER_FIELD", field);
    for (const field of ["source_sha256", "snapshot_sha256", "normalized_sha256"]) if (!SHA256.test(String(marker[field] || ""))) fail("INVALID_LINEAGE_HASH", field);
    if (marker.source_sha256 !== marker.snapshot_sha256) fail("SOURCE_SNAPSHOT_MISMATCH", "source_sha256 must equal snapshot_sha256");
    if (!marker.artifacts || typeof marker.artifacts !== "object") fail("MISSING_ARTIFACT_MAP", "marker.artifacts is required");

    const packageIds = new Set([marker.package_id, manifest.package_id]);
    const refreshIds = new Set([marker.refresh_id, manifest.refresh_id]);
    const markerContext = contextOf(marker);
    const compareContext = (label, value) => {
      const candidate = contextOf(value);
      for (const field of Object.keys(markerContext)) if (candidate[field] !== markerContext[field]) fail("PACKAGE_CONTEXT_MISMATCH", `${label}.${field}`);
    };
    compareContext("manifest", manifest);

    for (const [key, declaration] of Object.entries(artifacts)) {
      if (!declaration || typeof declaration !== "object") { fail("INVALID_ARTIFACT_DECLARATION", key); continue; }
      packageIds.add(declaration.package_id);
      refreshIds.add(declaration.refresh_id);
      if (declaration.artifact !== key) fail("ARTIFACT_KEY_MISMATCH", key);
      compareContext(`artifacts.${key}`, declaration);
      const expected = marker.artifacts && marker.artifacts[key];
      if (!expected) fail("UNDECLARED_ARTIFACT", key);
      else if (expected.status !== declaration.status) fail("ARTIFACT_STATUS_MISMATCH", key);
      if (declaration.status === "unavailable" && declaration.payload !== null) fail("UNAVAILABLE_ARTIFACT_HAS_DATA", key);
    }
    if (packageIds.size !== 1 || packageIds.has(undefined) || packageIds.has(null)) fail("CONFLICTING_OR_DUPLICATE_PACKAGE", [...packageIds].join(","));
    if (refreshIds.size !== 1 || refreshIds.has(undefined) || refreshIds.has(null)) fail("CONFLICTING_REFRESH", [...refreshIds].join(","));

    for (const [key, expected] of Object.entries(marker.artifacts || {})) {
      const declaration = artifacts[key];
      if (!declaration && expected.required) fail("MISSING_REQUIRED_ARTIFACT", key);
      if (!declaration && !expected.required && expected.status !== "unavailable") fail("MISSING_OPTIONAL_NOT_UNAVAILABLE", key);
      if (!SHA256.test(String(expected.sha256 || ""))) fail("INVALID_ARTIFACT_HASH", key);
    }

    const available = key => artifacts[key] && artifacts[key].status === "available" ? artifacts[key].payload : null;
    const weekly = available("weekly_plan");
    const gameplan = available("gameplan_weekly");
    const roster = available("rutgers_roster");
    const opponent = available("current_opponent");
    if (!weekly || !gameplan || !roster || !opponent) fail("MISSING_REQUIRED_PAYLOAD", "weekly_plan, gameplan_weekly, rutgers_roster, and current_opponent are required");
    if (weekly) {
      if (String(weekly.team && weekly.team.id) !== markerContext.team_id || Number(weekly.season) !== markerContext.season || Number(weekly.week) !== markerContext.week || String(weekly.opponent_id) !== markerContext.opponent_id || String(weekly.opponent) !== markerContext.opponent_name) fail("PACKAGE_PAYLOAD_CONTEXT_MISMATCH", "weekly_plan");
      if (!weekly.team || !weekly.team.name || !weekly.team.record || !weekly.location) fail("MISSING_REQUIRED_CONTEXT", "weekly_plan team/name/record/location");
    }
    if (gameplan && weekly && (String(gameplan.team_id) !== markerContext.team_id || gameplan.team_name !== weekly.team.name || gameplan.record !== weekly.team.record || Number(gameplan.season) !== markerContext.season || Number(gameplan.week) !== markerContext.week || String(gameplan.opponent_id) !== markerContext.opponent_id || gameplan.opponent !== markerContext.opponent_name || gameplan.location !== weekly.location)) fail("PACKAGE_PAYLOAD_CONTEXT_MISMATCH", "gameplan_weekly");
    if (roster && weekly && (String(roster.team && roster.team.id) !== markerContext.team_id || roster.team.name !== weekly.team.name || roster.team.record !== weekly.team.record || !Array.isArray(roster.players) || Number(roster.player_count) !== roster.players.length)) fail("PACKAGE_PAYLOAD_CONTEXT_MISMATCH", "rutgers_roster");
    if (opponent && (String(opponent.id) !== markerContext.opponent_id || opponent.name !== markerContext.opponent_name || !Array.isArray(opponent.players) || Number(opponent.player_count) !== opponent.players.length)) fail("PACKAGE_PAYLOAD_CONTEXT_MISMATCH", "current_opponent");

    const undeclaredGlobals = [...new Set([...SAVE_MANAGED_GLOBALS, ...Object.keys(scope).filter(name => FORBIDDEN_LEGACY_GLOBAL.test(name))])].filter(name => name in scope);
    for (const name of undeclaredGlobals) fail("UNDECLARED_SAVE_MANAGED_GLOBAL", name);

    const storage = options.storage === undefined ? scope.localStorage : options.storage;
    if (storage && typeof storage.getItem === "function") {
      for (const key of STORAGE_KEYS) {
        let raw;
        try { raw = storage.getItem(key); }
        catch (_) { fail("STORAGE_ACCESS_FAILED", key); continue; }
        if (!raw) continue;
        try {
          const saved = JSON.parse(raw);
          if (!saved.package_id || saved.package_id !== marker.package_id) fail("STALE_STORED_PACKAGE", key);
          else fail("STORED_PACKAGE_NOT_ALLOWED", key);
        } catch (_) { fail("INVALID_STORED_PACKAGE", key); }
      }
    }

    const observed = Array.isArray(options.observedPackages) ? options.observedPackages.filter(Boolean) : [];
    if (observed.length !== new Set(observed).size) fail("DUPLICATE_PACKAGE_ID", "observed package ID appeared more than once");
    if (new Set([marker.package_id, ...observed]).size !== 1) fail("CONFLICTING_OR_DUPLICATE_PACKAGE", "observed package IDs disagree");
    const result = { ok: errors.length === 0, error_code: errors[0] ? errors[0].code : null, errors, package_id: marker.package_id, refresh_id: marker.refresh_id };
    if (result.ok && scope && (typeof scope === "object" || typeof scope === "function")) successfulValidations.set(result, { scope, package_id: marker.package_id, refresh_id: marker.refresh_id });
    return result;
  }

  function installActivePackageCompatibilityGlobals(validationResult, scope = globalThis) {
    if (!validationResult || typeof validationResult !== "object") return { ok: false, status: "VALIDATION_REQUIRED", error_code: "VALIDATION_REQUIRED", compatibility_globals: [] };
    if (!validationResult.ok) return { ok: false, status: "VALIDATION_FAILED", error_code: validationResult.error_code || "PACKAGE_VALIDATION_FAILED", package_id: validationResult.package_id || null, refresh_id: validationResult.refresh_id || null, compatibility_globals: [] };
    const validated = successfulValidations.get(validationResult);
    if (!validated || validated.scope !== scope || validated.package_id !== validationResult.package_id || validated.refresh_id !== validationResult.refresh_id) return { ok: false, status: "VALIDATION_REQUIRED", error_code: "VALIDATION_REQUIRED", package_id: validationResult.package_id || null, refresh_id: validationResult.refresh_id || null, compatibility_globals: [] };
    const installed = installedScopes.get(scope);
    if (installed) {
      if (installed.package_id !== validationResult.package_id || installed.refresh_id !== validationResult.refresh_id) return { ok: false, status: "INSTALLATION_CONFLICT", error_code: "INSTALLATION_CONFLICT", package_id: validationResult.package_id, refresh_id: validationResult.refresh_id, compatibility_globals: [] };
      return { ok: true, status: "ALREADY_INSTALLED", error_code: null, package_id: installed.package_id, refresh_id: installed.refresh_id, compatibility_globals: [...COMPATIBILITY_GLOBALS] };
    }
    const marker = scope.ACTIVE_DYNASTY_PACKAGE;
    const artifacts = scope.ACTIVE_PACKAGE_ARTIFACTS;
    const weekly = artifacts.weekly_plan.payload;
    const gameplan = artifacts.gameplan_weekly.payload;
    const roster = artifacts.rutgers_roster.payload;
    const opponent = artifacts.current_opponent.payload;
    const playIds = (scope.RUTGERS_PLAYBOOK || []).slice(0, 12).map(play => play.id);
    if (playIds.length !== 12) return { ok: false, status: "INSTALLATION_FAILED", error_code: "ACTIVE_PACKAGE_PLAYBOOK_UNAVAILABLE", package_id: marker.package_id, refresh_id: marker.refresh_id, compatibility_globals: [] };
    const weeklyPlan = Object.freeze({
      schema_version: "direct_active_package_v1", package_id: marker.package_id, refresh_id: marker.refresh_id, source_of_truth: "dynasty_save",
      gameday: { title: "Gameday Gameplan", currentWeek: `Week ${weekly.week}`, seasonRecord: weekly.team.record, rutgersRank: "N/A", offenseRank: null, defenseRank: null, momentumStatus: "Validated active package", lastUpdated: "Immutable direct-package preview" },
      opponent: { name: weekly.opponent, team_id: weekly.opponent_id, record: "", week: `Week ${weekly.week}`, location: weekly.location, game_status: "Unplayed" },
      openingScript: playIds, familyModifiers: {}, modifierCaps: {}, riskRules: {}, traits: [], warnings: ["Tactical recommendations unavailable from active package"], players: {},
      tactical_recommendations: { status: "unavailable", recommendations: [] }
    });
    const gameplanWeekly = Object.freeze({
      schema_version: "direct_active_package_v1", package_type: "gameplan_weekly_update", package_id: marker.package_id, refresh_id: marker.refresh_id, source_of_truth: "dynasty_save",
      team_name: gameplan.team_name, season: gameplan.season, week: gameplan.week, rutgers_record: gameplan.record, opponent: gameplan.opponent, location: gameplan.location,
      opponent_profile: { team: opponent.name, name: opponent.name, team_id: opponent.id, record: "", verification_status: "active-package" }, opponent_players: opponent.players,
      opponent_position_groups: [], quick_tactical_summary: { status: "unavailable", avoid: [], recommendations: [] }, usage_plan: { status: "unavailable" }, matchups: [], run_direction: [], protection: [], last_game: {}, season_stats: {}, opponent_season_stats: {}
    });
    const rosterBase = Object.freeze({ schema_version: "direct_active_package_v1", package_id: marker.package_id, refresh_id: marker.refresh_id, source_truth: "dynasty_save", team: roster.team, players: roster.players, position_groups: [] });
    scope.WEEKLY_PLAN = weeklyPlan;
    scope.GAMEPLAN_WEEKLY = gameplanWeekly;
    scope.RUTGERS_ROSTER_BASE = rosterBase;
    installedScopes.set(scope, { package_id: marker.package_id, refresh_id: marker.refresh_id });
    if (scope.document && scope.document.documentElement) {
      const data = scope.document.documentElement.dataset;
      data.packageId = marker.package_id; data.refreshId = marker.refresh_id; data.previewSource = "direct-active-package";
      data.season = String(weekly.season); data.week = String(weekly.week); data.team = weekly.team.name; data.record = weekly.team.record; data.opponent = weekly.opponent; data.location = weekly.location;
      const observedIds = [marker.package_id, ...Object.values(artifacts).map(item => item.package_id), scope.WEEKLY_PLAN.package_id, scope.GAMEPLAN_WEEKLY.package_id, scope.RUTGERS_ROSTER_BASE.package_id];
      data.observedPackageIds = JSON.stringify([...new Set(observedIds)]);
      data.compatibilityGlobals = JSON.stringify(COMPATIBILITY_GLOBALS);
      data.undeclaredSaveGlobals = JSON.stringify(SAVE_MANAGED_GLOBALS.filter(name => name in scope && !COMPATIBILITY_GLOBALS.includes(name)));
    }
    return { ok: true, status: "INSTALLED", error_code: null, package_id: marker.package_id, refresh_id: marker.refresh_id, compatibility_globals: [...COMPATIBILITY_GLOBALS] };
  }

  function renderPackageValidationError(result, doc = typeof document !== "undefined" ? document : null) {
    if (!doc || !doc.body) return false;
    const panel = doc.createElement("section");
    panel.id = "packageValidationError";
    panel.setAttribute("role", "alert");
    panel.dataset.errorCode = result.error_code || "PACKAGE_VALIDATION_FAILED";
    if (result.package_id) panel.dataset.packageId = String(result.package_id);
    if (result.refresh_id) panel.dataset.refreshId = String(result.refresh_id);
    panel.textContent = `Startup blocked: active package validation failed (${panel.dataset.errorCode}). No dynasty package was loaded. Reload after the approved deployment completes.`;
    doc.body.replaceChildren(panel);
    return true;
  }

  return { COMPATIBILITY_GLOBALS, SAVE_MANAGED_GLOBALS, STORAGE_KEYS, contextOf, installActivePackageCompatibilityGlobals, validateActivePackage, renderPackageValidationError };
});
