const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { window: {}, localStorage: { getItem: () => "[]", setItem: () => {}, removeItem: () => {} } };
vm.createContext(context);

for (const file of ["data/rutgers_team.js", "data/rutgers_playbook.js", "data/weekly_plan.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}

const team = context.window.RUTGERS_TEAM;
const playbook = context.window.RUTGERS_PLAYBOOK;
const weekly = context.window.WEEKLY_PLAN;
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const source = fs.readFileSync(path.join(root, "docs", "SOURCE_EXTRACTION_REPORT.md"), "utf8");

const checks = [];
function check(name, passed, detail = "") {
  checks.push({ name, passed, detail });
}

const ids = new Set();
const duplicateIds = [];
for (const play of playbook) {
  if (ids.has(play.id)) duplicateIds.push(play.id);
  ids.add(play.id);
}
check("All play IDs are unique", duplicateIds.length === 0, duplicateIds.join(", "));

const openingUnique = new Set(weekly.openingScript);
const missingOpening = weekly.openingScript.filter(id => !ids.has(id));
check("Opening script has 12 valid unique references", weekly.openingScript.length === 12 && openingUnique.size === 12 && missingOpening.length === 0, missingOpening.join(", "));

const covered = new Set();
for (const play of playbook) for (const situation of play.situations || []) covered.add(situation);
const requiredSituations = ["short", "medium", "long", "red_zone", "goal_line", "two_minute", "normal", "must_score"];
const missingSituations = requiredSituations.filter(situation => !covered.has(situation));
check("Situation coverage exists for required app buckets", missingSituations.length === 0, missingSituations.join(", "));

check("Rutgers weekly data is separated from playbook data", fs.existsSync(path.join(root, "data", "rutgers_team.js")) && fs.existsSync(path.join(root, "data", "rutgers_playbook.js")));
check("Opponent weekly data is separated from game history", fs.existsSync(path.join(root, "data", "weekly_plan.js")) && fs.existsSync(path.join(root, "data", "game_history.js")));
check("Static no-JavaScript fallback exists", index.includes("<noscript>") && index.includes("STATIC PHONE FALLBACK") && index.includes("Rutgers vs Purdue"));
check("Weekly JSON import/export controls exist", index.includes("importWeekly") && index.includes("exportBtn") && app.includes("exportWeeklyJson") && app.includes("importWeeklyJson"));
check("Expanded result logging fields exist", ["yards", "sack", "turnover", "explosive", "thirdDownConversion", "redZoneTouchdown"].every(token => app.includes(token)));
check("History modifiers remain capped", app.includes("Math.max(-6, Math.min(6"));
check("localStorage persistence exists for history and weekly package", app.includes("rutgers_game_history") && app.includes("rutgers_weekly_package"));
check("Mobile layout rules exist", css.includes("@media(max-width:420px)") && css.includes("viewport-fit=cover") === false && index.includes("viewport-fit=cover"));
check("Purdue matchup traits appear", weekly.opponent.name === "Purdue" && weekly.traits.length >= 3 && JSON.stringify(weekly).includes("Gillians"));
check("Inside runs/RPOs/screens are promoted", weekly.familyModifiers.run_inside > 0 && weekly.familyModifiers.rpo > 0 && weekly.familyModifiers.screen > 0);
check("Slow deep dropbacks are penalized", weekly.familyModifiers.deep < 0 && weekly.riskRules.deep === "high");
check("No unconfirmed numeric ratings were added outside source anchors", team.overall === 84 && team.offense === 84 && team.defense === 86 && source.includes("84/84/86") && weekly.opponent.record === "1-4");

const report = [
  "# VALIDATION_REPORT",
  "",
  `Validated: ${new Date().toISOString()}`,
  "",
  ...checks.map(item => `- ${item.passed ? "PASS" : "FAIL"} - ${item.name}${item.detail ? ` (${item.detail})` : ""}`),
  "",
  checks.every(item => item.passed) ? "Overall: PASS" : "Overall: FAIL"
].join("\n");

fs.writeFileSync(path.join(root, "VALIDATION_REPORT.md"), report + "\n");
console.log(report);
if (!checks.every(item => item.passed)) process.exit(1);
