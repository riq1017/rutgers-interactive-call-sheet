#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SHA256 = /^[a-f0-9]{64}$/;
const REQUIRED_WRAPPERS = ["weekly_manifest", "weekly_plan", "gameplan_weekly", "rutgers_roster", "current_opponent"];
const OPTIONAL_WRAPPERS = ["statistics", "injuries", "matchups", "recruiting", "recovery", "current_week_ui"];
const WRAPPER_ORDER = [...REQUIRED_WRAPPERS.slice(0, 1), ...REQUIRED_WRAPPERS.slice(1), ...OPTIONAL_WRAPPERS];
const FORBIDDEN = /data\/active\/|data\/(?:engine_data|recruiting_data|phase1_verified_data|player_media)\.js|save-preview-bridge\.js|app-definitions\.js|purdue|opponent[_-]media/i;

class ArtifactError extends Error {
  constructor(code, detail) { super(`${code}: ${detail}`); this.code = code; this.detail = detail; }
}
function fail(code, detail) { throw new ArtifactError(code, detail); }
function sha256File(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function normalizeRel(value) {
  const decoded = decodeURIComponent(String(value).replace(/\\/g, "/")).replace(/^\.\//, "");
  if (!decoded || decoded.startsWith("/") || /^[a-z]+:/i.test(decoded) || decoded.split("/").includes("..")) fail("INVALID_RESOURCE_PATH", value);
  return decoded;
}
function walk(root) {
  const out = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) fail("INVALID_RESOURCE_PATH", `symbolic link: ${full}`);
      if (entry.isDirectory()) visit(full); else if (entry.isFile()) out.push(path.relative(root, full).replace(/\\/g, "/"));
    }
  }
  visit(root); return out.sort();
}
function scriptSources(html) { return [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi)].map(match => match[1]); }
function localReferences(text, kind) {
  const refs = [];
  const patterns = kind === "css" ? [/url\(\s*["']?([^)'"\s]+)["']?\s*\)/gi, /@import\s+["']([^"']+)["']/gi]
    : [/(?:src|href)=["']([^"']+)["']/gi];
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) {
    if (!/^(?:data:|https?:|#)/i.test(match[1])) refs.push(match[1]);
  }
  return refs;
}
function validateSemanticRuntime(root) {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const runtime = fs.readFileSync(path.join(root, "package_runtime.js"), "utf8");
  const appChecks = [
    ["LEGACY_RUNTIME_GLOBAL_ACCESS", /\b(?:(?:PURDUE|UMASS)_[A-Z0-9_]*|VIDEO_VERIFIED_(?:PURDUE|UMASS)_[A-Z0-9_]*|PLAYER_MATCHUPS|OPPONENT_(?:DATA|LAST_GAME_STATS|SEASON_STATS|PLAYER_MEDIA))\b/],
    ["OPPONENT_SPECIFIC_FALLBACK", /function\s+[A-Za-z0-9_$]*(?:Purdue|UMass)[A-Za-z0-9_$]*\s*\(|\b(?:includes|startsWith|endsWith)\s*\(\s*["'`]umass["'`]/i],
    ["STALE_PRODUCTION_VERSION", /APP_DATA_VERSION\s*=\s*["'`][^"'`]*(?:week\s*1|week1|umass)[^"'`]*["'`]/i]
  ];
  for (const [code, pattern] of appChecks) if (pattern.test(app)) fail(code, "app.js contains active stale opponent semantics");

  const defensiveDeclaration = runtime.match(/const\s+FORBIDDEN_LEGACY_GLOBAL\s*=\s*\/[^\n;]+\/[a-z]*\s*;/i);
  if (!defensiveDeclaration) fail("DEFENSIVE_LEGACY_REJECTION_MISSING", "package_runtime.js");
  const compatibility = runtime.match(/const\s+COMPATIBILITY_GLOBALS\s*=\s*Object\.freeze\(\[([^\]]*)\]\)/);
  if (!compatibility || /PURDUE|UMASS|OPPONENT_|PLAYER_MATCHUPS/i.test(compatibility[1])) fail("LEGACY_COMPATIBILITY_GLOBAL", "package_runtime.js compatibility surface");
  const activeRuntime = defensiveDeclaration ? runtime.replace(defensiveDeclaration[0], "") : runtime;
  if (/\b(?:(?:PURDUE|UMASS)_[A-Z0-9_]*|VIDEO_VERIFIED_(?:PURDUE|UMASS)_[A-Z0-9_]*)\b/.test(activeRuntime)) fail("LEGACY_RUNTIME_GLOBAL_ACCESS", "package_runtime.js contains non-defensive opponent-specific access");
}
function evaluatePackage(root, packageDir, names) {
  const scope = { globalThis: null }; scope.globalThis = scope; vm.createContext(scope);
  const files = ["active_package", ...names];
  for (const name of files) {
    const file = path.join(root, packageDir, `${name}.js`);
    if (!fs.existsSync(file)) fail(REQUIRED_WRAPPERS.includes(name) || name === "active_package" ? "MISSING_REQUIRED_ARTIFACT" : "OPTIONAL_ARTIFACT_CONTRACT_INVALID", name);
    try { vm.runInContext(fs.readFileSync(file, "utf8"), scope, { filename: file }); }
    catch (error) { fail("PACKAGE_SCRIPT_INVALID", `${name}: ${error.message}`); }
  }
  return scope;
}
function validateArtifact(rootInput, options = {}) {
  const root = path.resolve(rootInput);
  if (!fs.statSync(root).isDirectory()) fail("ARTIFACT_NOT_DIRECTORY", root);
  const manifestPath = path.join(root, "deployment-manifest.json");
  if (!fs.existsSync(manifestPath)) fail("MISSING_DEPLOYMENT_MANIFEST", manifestPath);
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch (error) { fail("INVALID_DEPLOYMENT_MANIFEST", error.message); }
  if (manifest.schema_version !== "cfb27_deployment_manifest_v1") fail("INVALID_DEPLOYMENT_MANIFEST", "schema_version");
  for (const field of ["release_id", "package_id", "refresh_id", "source_sha256", "snapshot_sha256", "normalized_sha256", "source_commit", "generated_at", "startup_script_order", "permanent_input_allowlist", "active_package_artifacts", "files"])
    if (manifest[field] === undefined || manifest[field] === null) fail("INVALID_DEPLOYMENT_MANIFEST", field);
  for (const field of ["source_sha256", "snapshot_sha256", "normalized_sha256"]) if (!SHA256.test(String(manifest[field]))) fail("INVALID_DEPLOYMENT_MANIFEST", field);
  if (manifest.source_sha256 !== manifest.snapshot_sha256) fail("SOURCE_SNAPSHOT_MISMATCH", "source_sha256 differs from snapshot_sha256");

  const allFiles = walk(root);
  const metadata = new Set(["deployment-manifest.json", "validation-report.json"]);
  const deployed = allFiles.filter(file => !metadata.has(file));
  const declared = Object.keys(manifest.files || {}).sort();
  const undeclared = deployed.filter(file => !declared.includes(file));
  if (undeclared.length) fail("UNDECLARED_FILE", undeclared[0]);
  const missing = declared.filter(file => !deployed.includes(file));
  if (missing.length) fail("MISSING_DEPLOYED_FILE", missing[0]);
  for (const rel of declared) {
    if (FORBIDDEN.test(rel)) fail("LEGACY_RESOURCE_FORBIDDEN", rel);
    const entry = manifest.files[rel];
    if (!entry || !SHA256.test(entry.sha256) || sha256File(path.join(root, rel)) !== entry.sha256) fail("DEPLOYED_FILE_HASH_MISMATCH", rel);
  }
  validateSemanticRuntime(root);

  const packageRoot = path.join(root, "data", "active-packages");
  if (!fs.existsSync(packageRoot)) fail("MISSING_REQUIRED_ARTIFACT", "data/active-packages");
  const packageDirs = fs.readdirSync(packageRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
  if (packageDirs.length !== 1) fail("MULTIPLE_PACKAGE_DIRECTORIES", packageDirs.join(","));
  if (packageDirs[0] !== manifest.package_id) fail("PACKAGE_ID_CONFLICT", packageDirs[0]);
  const packageDir = `data/active-packages/${packageDirs[0]}`;

  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  if (FORBIDDEN.test(html)) fail("LEGACY_RESOURCE_FORBIDDEN", "index.html");
  const controlledAt = html.indexOf('globalThis.CFB27_APP_STARTUP_MODE="controlled"');
  const sources = scriptSources(html);
  const expected = manifest.startup_script_order;
  const tokens = new Set();
  for (const source of sources) {
    const url = new URL(source, "https://artifact.invalid/");
    const token = url.searchParams.get("r");
    if (!token) fail("RELEASE_ID_CONFLICT", source);
    tokens.add(token);
    const clean = normalizeRel(url.pathname.slice(1));
    if (!fs.existsSync(path.join(root, clean))) fail("TRANSITIVE_RESOURCE_MISSING", clean);
    if (clean.startsWith("data/active-packages/") && !clean.startsWith(`${packageDir}/`)) fail("CROSS_PACKAGE_SCRIPT_REFERENCE", clean);
  }
  if (tokens.size !== 1 || !tokens.has(manifest.release_id)) fail("RELEASE_ID_CONFLICT", [...tokens].join(","));
  if (JSON.stringify(sources) !== JSON.stringify(expected)) fail("STARTUP_ORDER_INVALID", "script list differs from manifest");
  const runtimeIndex = sources.findIndex(value => value.startsWith("package_runtime.js?"));
  const appIndex = sources.findIndex(value => value.startsWith("app.js?"));
  const startupIndex = sources.findIndex(value => value.startsWith("production_startup.js?"));
  if (controlledAt < 0 || appIndex < 0 || html.indexOf(sources[appIndex]) < controlledAt) fail("CONTROLLED_MODE_ORDER_INVALID", "controlled mode must precede app.js");
  if (!(runtimeIndex >= 0 && runtimeIndex < appIndex && appIndex < startupIndex && startupIndex === sources.length - 1)) fail("STARTUP_ORDER_INVALID", "runtime/app/controller order");
  if ((html.match(/production_startup\.js/g) || []).length !== 1 || /package_startup\.js|CFB27_APP_BOOT\s*\(/.test(html)) fail("STARTUP_ORCHESTRATOR_INVALID", "production_startup.js must be sole orchestrator");

  const names = [...WRAPPER_ORDER];
  const scope = evaluatePackage(root, packageDir, names);
  const marker = scope.ACTIVE_DYNASTY_PACKAGE, weeklyManifest = scope.ACTIVE_PACKAGE_MANIFEST, artifacts = scope.ACTIVE_PACKAGE_ARTIFACTS;
  if (!marker || !weeklyManifest || !artifacts) fail("MISSING_REQUIRED_ARTIFACT", "marker/manifest/registry");
  const packageIds = new Set([manifest.package_id, marker.package_id, weeklyManifest.package_id, ...Object.values(artifacts).map(value => value.package_id)]);
  const refreshIds = new Set([manifest.refresh_id, marker.refresh_id, weeklyManifest.refresh_id, ...Object.values(artifacts).map(value => value.refresh_id)]);
  if (packageIds.size !== 1) fail("PACKAGE_ID_CONFLICT", [...packageIds].join(","));
  if (refreshIds.size !== 1) fail("REFRESH_ID_CONFLICT", [...refreshIds].join(","));
  for (const field of ["source_sha256", "snapshot_sha256", "normalized_sha256"]) if (marker[field] !== manifest[field]) fail("LINEAGE_HASH_MISMATCH", field);
  const contextFields = ["team_id", "season", "week", "opponent_id", "opponent_name"];
  for (const [name, value] of [["weekly_manifest", weeklyManifest], ...Object.entries(artifacts)]) for (const field of contextFields)
    if (String(value[field]) !== String(marker[field])) fail("PACKAGE_CONTEXT_MISMATCH", `${name}.${field}`);
  for (const name of names) {
    const declaration = artifacts[name];
    const expectedArtifact = marker.artifacts && marker.artifacts[name];
    if (!declaration || !expectedArtifact) fail(REQUIRED_WRAPPERS.includes(name) ? "MISSING_REQUIRED_ARTIFACT" : "OPTIONAL_ARTIFACT_CONTRACT_INVALID", name);
    const rel = `${packageDir}/${name}.js`;
    if (expectedArtifact.sha256 !== sha256File(path.join(root, rel))) fail("ARTIFACT_HASH_MISMATCH", name);
    if (declaration.status !== expectedArtifact.status) fail("PACKAGE_CONTEXT_MISMATCH", `${name}.status`);
    if (declaration.status === "unavailable" && declaration.payload !== null) fail("OPTIONAL_ARTIFACT_CONTRACT_INVALID", name);
    if (declaration.status === "available" && declaration.payload == null) fail("OPTIONAL_ARTIFACT_CONTRACT_INVALID", name);
  }

  const refs = [...localReferences(html, "html")];
  const manifestWeb = path.join(root, "manifest.webmanifest");
  if (fs.existsSync(manifestWeb)) {
    const web = JSON.parse(fs.readFileSync(manifestWeb, "utf8"));
    refs.push(web.start_url, ...(web.icons || []).map(icon => icon.src));
  }
  for (const rel of allFiles.filter(file => file.endsWith(".css"))) refs.push(...localReferences(fs.readFileSync(path.join(root, rel), "utf8"), "css"));
  for (const ref of refs.filter(Boolean)) {
    const url = new URL(ref, "https://artifact.invalid/");
    if (url.searchParams.get("r") !== manifest.release_id) fail("RELEASE_ID_CONFLICT", ref);
    const rel = normalizeRel(url.pathname.slice(1));
    if (!fs.existsSync(path.join(root, rel))) fail("TRANSITIVE_RESOURCE_MISSING", rel);
    if (!metadata.has(rel) && !declared.includes(rel)) fail("TRANSITIVE_RESOURCE_UNDECLARED", rel);
  }
  const forbiddenStorage = /localStorage\.(?:setItem|removeItem)\s*\(\s*["'`](?:rutgers_weekly_package|rutgers_gameplan_weekly_v2|rutgers_recruiting_weekly_v2)/;
  if (forbiddenStorage.test(fs.readFileSync(path.join(root, "production_startup.js"), "utf8"))) fail("STORAGE_BOUNDARY_INVALID", "controller package storage mutation");
  return { ok: true, release_id: manifest.release_id, package_id: manifest.package_id, refresh_id: manifest.refresh_id, file_count: deployed.length };
}

if (require.main === module) {
  try { console.log(JSON.stringify(validateArtifact(process.argv[2]), null, 2)); }
  catch (error) { console.error(JSON.stringify({ ok: false, error_code: error.code || "VALIDATION_EXCEPTION", detail: error.detail || error.message }, null, 2)); process.exitCode = 1; }
}
module.exports = { ArtifactError, OPTIONAL_WRAPPERS, REQUIRED_WRAPPERS, WRAPPER_ORDER, sha256File, validateArtifact };
