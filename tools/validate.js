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
global.RUTGERS_PLAYBOOK = playbook;
global.WEEKLY_PLAN = weekly;
global.window = { GAME_HISTORY: [] };
global.localStorage = { getItem: () => "[]", setItem: () => {}, removeItem: () => {} };
const engine = require(path.join(root, "app.js"));

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
check("Recent-call memory key exists", app.includes("rutgers_recent_calls") && app.includes("slice(-8)"));
check("Visible score explanation exists", ["Base", "Matchup", "Situation", "Recent", "Setup", "Risk", "Final"].every(token => app.includes(token)));

const insideRun = playbook.find(play => engine.conceptFamily(play) === "inside run");
const secondInsideRun = playbook.find(play => engine.conceptFamily(play) === "inside run" && play.id !== insideRun.id);
const rpo = playbook.find(play => engine.conceptFamily(play) === "RPO");
const playAction = playbook.find(play => engine.conceptFamily(play) === "play action");
const quick = playbook.find(play => engine.conceptFamily(play) === "quick pass");
const screen = playbook.find(play => engine.conceptFamily(play) === "screen");
const deep = playbook.find(play => engine.conceptFamily(play) === "deep pass");
const mediumContext = { down: "1", dist: "medium", zone: "normal", gameState: "normal", key: "medium" };
const thirdMediumContext = { down: "3", dist: "medium", zone: "normal", gameState: "normal", key: "medium" };
const redZoneContext = { down: "2", dist: "medium", zone: "red_zone", gameState: "normal", key: "red_zone" };
const protectLeadContext = { down: "1", dist: "medium", zone: "normal", gameState: "protect_lead", key: "short" };
const mustScoreContext = { down: "1", dist: "long", zone: "normal", gameState: "must_score", key: "must_score" };

const exactLast = engine.recentCallPenalty(insideRun, [{ playId: insideRun.id, family: "inside run" }]);
const exactWithinThree = engine.recentCallPenalty(insideRun, [
  { playId: "other-a", family: "RPO" },
  { playId: insideRun.id, family: "inside run" },
  { playId: "other-b", family: "screen" }
]);
const exactWithinSix = engine.recentCallPenalty(insideRun, [
  { playId: insideRun.id, family: "inside run" },
  { playId: "other-a", family: "RPO" },
  { playId: "other-b", family: "screen" },
  { playId: "other-c", family: "quick pass" }
]);
check("Exact-play repetition penalties work", exactLast.reasons.includes("same play last call -18") && exactWithinThree.reasons.includes("same play within last 3 -10") && exactWithinSix.reasons.includes("same play within last 6 -5"));

const familyRotation = engine.recentCallPenalty(insideRun, [
  { playId: "old-a", family: "inside run" },
  { playId: "old-b", family: "inside run" },
  { playId: "old-c", family: "screen" },
  { playId: "old-d", family: "RPO" },
  { playId: secondInsideRun.id, family: "inside run" }
]);
check("Family rotation penalties work", familyRotation.reasons.includes("same family consecutive -8") && familyRotation.reasons.includes("same family 3 of last 5 -6"));

const runSetupHistory = [
  { playId: insideRun.id, result: "success" },
  { playId: secondInsideRun.id, result: "success" }
];
const paSetup = engine.setupBonus(playAction, runSetupHistory);
const rpoSetup = engine.setupBonus(rpo, runSetupHistory);
check("Successful runs promote play action and RPOs", paSetup.value >= 8 && rpoSetup.value >= 6);

const screenSetup = engine.setupBonus(insideRun, [{ playId: screen.id, result: "success" }]);
const quickSetup = engine.setupBonus(deep, [{ playId: quick.id, result: "success" }]);
const sackSetup = engine.setupBonus(screen, [{ playId: deep.id, result: "failure", sack: true }]);
check("Setup bonuses respond to screens, quick passes, failed deep passes and sacks", screenSetup.value >= 3 && quickSetup.value >= 4 && sackSetup.value >= 5);

const ranked = engine.buildRankings(mediumContext, [], []);
const top3 = engine.diverseTop(ranked, 3);
check("Top 3 contains concept diversity", new Set(top3.map(play => play.conceptFamily)).size >= 2);

let recent = [];
const repeatedSets = [];
for (let i = 0; i < 6; i++) {
  const picks = engine.diverseTop(engine.buildRankings(mediumContext, [], recent), 3);
  repeatedSets.push(picks.map(play => play.id).join("|"));
  for (const pick of picks) recent.push({ playId: pick.id, family: pick.conceptFamily });
  recent = recent.slice(-8);
}
check("Repeated button presses do not return the same 3 plays indefinitely", new Set(repeatedSets).size > 1);

const thirdMediumTop = engine.buildRankings(thirdMediumContext, [], [])[0].conceptFamily;
const redZoneTop = engine.buildRankings(redZoneContext, [], [])[0].score;
const protectTop = engine.buildRankings(protectLeadContext, [], [])[0].conceptFamily;
const mustScoreDeepScore = engine.scorePlay(deep, mustScoreContext, [], []).score;
const normalDeepScore = engine.scorePlay(deep, mediumContext, [], []).score;
check("Rankings still respond to down, distance, field zone and game state", ["quick pass", "intermediate pass", "RPO"].includes(thirdMediumTop) && redZoneTop !== ranked[0].score && ["inside run", "outside run", "quick pass", "screen", "RPO"].includes(protectTop) && mustScoreDeepScore !== normalDeepScore);

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
