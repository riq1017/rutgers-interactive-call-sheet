#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { WRAPPER_ORDER, sha256File, validateArtifact } = require("./validate_deployment_artifact");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_OUTPUT_ROOT = path.join(REPO_ROOT, "outputs", "deployments");
const RELEASE_ID = /^[a-z0-9][a-z0-9._-]{7,127}$/i;
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i] || !argv[i].startsWith("--") || argv[i + 1] === undefined) throw new Error(`Expected --name value near ${argv[i] || "end"}`);
    out[argv[i].slice(2)] = argv[i + 1];
  }
  if (!out["package-dir"] || !out["release-id"]) throw new Error("--package-dir and --release-id are required");
  return out;
}
function copyExclusive(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
}
function writeExclusive(file, text) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text, { encoding: "utf8", flag: "wx" }); }
function safeRemoveTemporary(dir, temporaryRoot) {
  const resolved = path.resolve(dir), allowed = path.resolve(temporaryRoot) + path.sep;
  if (!resolved.startsWith(allowed)) throw new Error(`Refused temporary cleanup outside ${temporaryRoot}`);
  if (fs.existsSync(resolved)) fs.rmSync(resolved, { recursive: true, force: true });
}
function loadPackage(packageDir) {
  const scope = { globalThis: null }; scope.globalThis = scope; vm.createContext(scope);
  for (const name of ["active_package", ...WRAPPER_ORDER]) {
    const file = path.join(packageDir, `${name}.js`);
    if (!fs.existsSync(file)) throw new Error(`Package source missing ${name}.js`);
    vm.runInContext(fs.readFileSync(file, "utf8"), scope, { filename: file });
  }
  return scope;
}
function rutgersMediaText() {
  const scope = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(REPO_ROOT, "data", "player_media.js"), "utf8"), scope);
  const source = scope.window.RUTGERS_PLAYER_MEDIA;
  if (!source || source.team !== "Rutgers" || !Array.isArray(source.players)) throw new Error("Rutgers media source is invalid");
  const allowed = ["player_id", "portrait_path", "media_type", "framing", "uniform", "background", "source_status"];
  const players = source.players.map(player => {
    if (!/^assets\/player-portraits\/rutgers\/[a-z0-9-]+\.svg$/i.test(player.portrait_path || "") || player.uniform !== "Rutgers scarlet") throw new Error(`Unsafe Rutgers media row: ${player.player_id}`);
    return Object.fromEntries(allowed.filter(key => player[key] !== undefined).map(key => [key, player[key]]));
  });
  return { text: `"use strict";\nglobalThis.RUTGERS_PLAYER_MEDIA=Object.freeze(${JSON.stringify({ schema_version: "cfb27_rutgers_media_allowlist_v1", package_type: "rutgers_player_media", team: "Rutgers", players })});\n`, players };
}
function token(ref, releaseId) { return `${ref}?r=${encodeURIComponent(releaseId)}`; }
function generateHtml(releaseId, packageId, sourceHtml) {
  let html = sourceHtml === undefined ? fs.readFileSync(path.join(REPO_ROOT, "index.html"), "utf8") : String(sourceHtml);
  html = html.replace('href="manifest.webmanifest"', `href="${token("manifest.webmanifest", releaseId)}"`)
    .replace(/href="assets\/app-icon\.svg"/g, `href="${token("assets/app-icon.svg", releaseId)}"`)
    .replace('href="styles.css"', `href="${token("styles.css", releaseId)}"`);
  const packagePrefix = `data/active-packages/${packageId}`;
  const sources = [token(`${packagePrefix}/active_package.js`, releaseId), ...WRAPPER_ORDER.map(name => token(`${packagePrefix}/${name}.js`, releaseId)), token("data/rutgers_playbook.js", releaseId), token("data/rutgers_media.js", releaseId), token("package_runtime.js", releaseId), token("app.js", releaseId), token("production_startup.js", releaseId)];
  const scripts = `<script>globalThis.CFB27_APP_STARTUP_MODE="controlled";globalThis.CFB27_DEPLOYMENT_RELEASE_ID=${JSON.stringify(releaseId)};</script>\n${sources.map(src => `<script src="${src}"></script>`).join("\n")}`;
  const startupBlock = /(\s*<script(?:\s[^>]*)?>[\s\S]*?<\/script>)+\s*(?=<\/body>)/i;
  if (!startupBlock.test(html)) throw new Error("Could not locate deployment startup block");
  html = html.replace(startupBlock, `\n${scripts}\n`);
  if ((html.match(/production_startup\.js/g) || []).length !== 1 || html.includes("data/engine_data.js")) throw new Error("Could not generate controlled deployment HTML");
  return { html, sources };
}
function generateWebManifest(releaseId) {
  const value = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "manifest.webmanifest"), "utf8"));
  value.start_url = token("./index.html", releaseId);
  for (const icon of value.icons || []) icon.src = token(icon.src, releaseId);
  return `${JSON.stringify(value, null, 2)}\n`;
}
function run(options) {
  const releaseId = options["release-id"];
  if (!RELEASE_ID.test(releaseId)) throw new Error("Invalid release ID");
  const packageSource = path.resolve(options["package-dir"]), outputRoot = path.resolve(options["output-root"] || DEFAULT_OUTPUT_ROOT);
  const sourceCommit = String(options["source-commit"] || "unknown");
  const finalDir = path.join(outputRoot, releaseId), temporaryRoot = path.join(outputRoot, ".tmp");
  if (fs.existsSync(finalDir)) throw new Error(`Release directory already exists: ${finalDir}`);
  if (!fs.statSync(packageSource).isDirectory() || fs.lstatSync(packageSource).isSymbolicLink()) throw new Error("Package source must be a real directory");
  const scope = loadPackage(packageSource), marker = scope.ACTIVE_DYNASTY_PACKAGE;
  if (!marker || path.basename(packageSource) !== marker.package_id) throw new Error("Package directory name must equal package_id");
  if (new Set([marker.package_id, scope.ACTIVE_PACKAGE_MANIFEST.package_id, ...Object.values(scope.ACTIVE_PACKAGE_ARTIFACTS).map(value => value.package_id)]).size !== 1) throw new Error("Package source contains mixed package IDs");
  if (new Set([marker.refresh_id, scope.ACTIVE_PACKAGE_MANIFEST.refresh_id, ...Object.values(scope.ACTIVE_PACKAGE_ARTIFACTS).map(value => value.refresh_id)]).size !== 1) throw new Error("Package source contains mixed refresh IDs");
  for (const name of WRAPPER_ORDER) if (marker.artifacts[name].sha256 !== sha256File(path.join(packageSource, `${name}.js`))) throw new Error(`Package source hash mismatch: ${name}`);
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const tempDir = path.join(temporaryRoot, `${releaseId}-${process.pid}-${crypto.randomBytes(4).toString("hex")}`);
  fs.mkdirSync(tempDir);
  try {
    for (const name of ["styles.css", "package_runtime.js", "app.js", "production_startup.js"]) copyExclusive(path.join(REPO_ROOT, name), path.join(tempDir, name));
    copyExclusive(path.join(REPO_ROOT, "data", "rutgers_playbook.js"), path.join(tempDir, "data", "rutgers_playbook.js"));
    const packageDest = path.join(tempDir, "data", "active-packages", marker.package_id);
    for (const name of ["active_package", ...WRAPPER_ORDER]) copyExclusive(path.join(packageSource, `${name}.js`), path.join(packageDest, `${name}.js`));
    const media = rutgersMediaText(); writeExclusive(path.join(tempDir, "data", "rutgers_media.js"), media.text);
    copyExclusive(path.join(REPO_ROOT, "assets", "app-icon.svg"), path.join(tempDir, "assets", "app-icon.svg"));
    const portraits = [...new Set(media.players.map(player => player.portrait_path))];
    for (const rel of portraits) copyExclusive(path.join(REPO_ROOT, rel), path.join(tempDir, rel));
    const diagrams = [...new Set([...fs.readFileSync(path.join(REPO_ROOT, "data", "rutgers_playbook.js"), "utf8").matchAll(/assets\/play-diagrams\/[a-z0-9._-]+/gi)].map(match => match[0]))];
    for (const rel of diagrams) copyExclusive(path.join(REPO_ROOT, rel), path.join(tempDir, rel));
    const generated = generateHtml(releaseId, marker.package_id); writeExclusive(path.join(tempDir, "index.html"), generated.html);
    writeExclusive(path.join(tempDir, "manifest.webmanifest"), generateWebManifest(releaseId));
    const contentFiles = [];
    const visit = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) visit(full); else contentFiles.push(path.relative(tempDir, full).replace(/\\/g, "/")); } };
    visit(tempDir);
    const permanent = ["styles.css", "manifest.webmanifest", "package_runtime.js", "app.js", "production_startup.js", "data/rutgers_playbook.js", "data/rutgers_media.js", "assets/app-icon.svg", ...portraits, ...diagrams].sort();
    const manifest = {
      schema_version: "cfb27_deployment_manifest_v1", release_id: releaseId, package_id: marker.package_id, refresh_id: marker.refresh_id,
      source_sha256: marker.source_sha256, snapshot_sha256: marker.snapshot_sha256, normalized_sha256: marker.normalized_sha256,
      source_commit: sourceCommit, generated_at: new Date().toISOString(), previous_known_good_release_id: options["previous-release-id"] || null,
      startup_script_order: generated.sources, permanent_input_allowlist: permanent,
      active_package_artifacts: ["active_package", ...WRAPPER_ORDER].map(name => `data/active-packages/${marker.package_id}/${name}.js`), files: {}
    };
    for (const rel of contentFiles.sort()) manifest.files[rel] = { sha256: sha256File(path.join(tempDir, rel)), size: fs.statSync(path.join(tempDir, rel)).size };
    writeExclusive(path.join(tempDir, "deployment-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    const result = validateArtifact(tempDir);
    writeExclusive(path.join(tempDir, "validation-report.json"), `${JSON.stringify({ schema_version: "cfb27_deployment_validation_v1", generated_at: new Date().toISOString(), ...result }, null, 2)}\n`);
    if (fs.existsSync(finalDir)) throw new Error(`Release directory already exists: ${finalDir}`);
    fs.renameSync(tempDir, finalDir);
    return { ...result, directory: finalDir, manifest: path.join(finalDir, "deployment-manifest.json"), validation_report: path.join(finalDir, "validation-report.json") };
  } catch (error) { safeRemoveTemporary(tempDir, temporaryRoot); throw error; }
}
if (require.main === module) {
  try { console.log(JSON.stringify(run(parseArgs(process.argv.slice(2))), null, 2)); }
  catch (error) { console.error(error.stack || error.message); process.exitCode = 1; }
}
module.exports = { generateHtml, parseArgs, run, safeRemoveTemporary };
