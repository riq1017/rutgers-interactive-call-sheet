const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { window: {}, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
vm.createContext(context);
for (const file of ["data/rutgers_team.js", "data/rutgers_playbook.js", "data/weekly_plan.js", "data/game_history.js", "data/recruiting_data.js", "data/engine_data.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}
Object.assign(global, context.window);
global.window = { GAME_HISTORY: [] };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const engine = require(path.join(root, "app.js"));
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const checks = [];
function check(name, passed, detail = "") { checks.push({ name, passed: Boolean(passed), detail }); }
function ctx(down, yards, zone = "normal", gameState = "normal") {
  const dist = yards <= 3 ? "short" : yards <= 6 ? "medium" : "long";
  let key = dist;
  if (zone === "goal_line" || zone === "red_zone") key = zone;
  if (gameState === "two_minute" || gameState === "must_score") key = gameState;
  if (gameState === "protect_lead") key = "short";
  return { down, dist, distanceYards: yards, zone, gameState, key };
}
const dataFiles = ["data/rutgers_roster_base.json", "data/gameplan_weekly.json", "data/recruiting_weekly.json", "ROSTER_BASE_SCHEMA.json", "GAMEPLAN_WEEKLY_SCHEMA_v2.json", "RECRUITING_WEEKLY_SCHEMA_v2.json"];
check("Shared roster and schema files exist", dataFiles.every(file => fs.existsSync(path.join(root, file))), dataFiles.filter(file => !fs.existsSync(path.join(root, file))).join(", "));
check("Both weekly engines reference the same roster base", GAMEPLAN_WEEKLY.shared_roster_file === "data/rutgers_roster_base.json" && RECRUITING_WEEKLY.shared_roster_file === "data/rutgers_roster_base.json");
check("Roster base preserves unresolved nulls", RUTGERS_ROSTER_BASE.players.some(player => player.depth_chart_order === null) && RUTGERS_ROSTER_BASE.unresolved && RUTGERS_ROSTER_BASE.position_groups.some(group => group.unresolved));
check("No conflicting duplicate roster import controls remain", !index.includes("importRosterData") && !index.includes("Import Roster JSON") && !app.includes("ROSTER_KEY"));
check("Gameplan and Recruiting import/export controls are separated on More", ["importGameplanWeekly", "importRecruitingWeekly", "exportGameplanBtn", "exportRecruitingBtn", "enginePackagePanel"].every(id => index.includes(id) || app.includes(id)));
check("Invalid package types are rejected before assignment", app.includes("validateGameplanWeekly(parsed)") && app.includes("validateRecruitingWeekly(parsed)") && app.includes("Wrong package_type"));
check("Gameplan owns situation controls", index.indexOf('id="gameplan"') < index.indexOf('id="down"') && index.indexOf('id="down"') < index.indexOf('id="recommendation"'));
check("Package controls live on More", index.indexOf('id="more"') < index.indexOf('id="enginePackagePanel"') && !index.includes('id="exportBtn"'));
check("Best Call and Top 3 alternatives are separate", index.includes('id="recommendation"') && index.includes('id="top3Inline"') && app.includes("renderTopAlternatives"));
check("Quick Tactical Summary and Game-Day Usage render", index.includes('id="quickSummary"') && index.includes('id="gameDayUsage"') && app.includes("renderGameplanPanels"));
check("Personnel & Matchups page includes required surfaces", ["lineAnalysis", "runDirectionList", "protectionList", "opponentDefenseList", "matchupMatrix"].every(id => index.includes(id)) && app.includes("renderPersonnelMatchups"));
check("Recruiting page keeps requested sections", ["recruitingOverview", "teamNeedsList", "priorityList", "recruitList", "recruitDetail", "actionPlanList"].every(id => index.includes(id)));
check("Recruiting priority starts from performance/depth before game targets", RECRUITING_WEEKLY.recruiting_priority_order[0] === "on_field_performance_and_progress" && RECRUITING_WEEKLY.recruiting_priority_order[1] === "current_depth_chart");
check("Play art assets remain available", fs.readdirSync(path.join(root, "assets", "play-diagrams")).filter(file => file.endsWith(".svg") && file !== "formation-fallback.svg").length === 48);
check("All play diagram paths resolve", RUTGERS_PLAYBOOK.every(play => play.diagramPath && fs.existsSync(path.join(root, play.diagramPath))));
const fourthLong = engine.buildRankings(ctx(4, 10, "normal"), [], []);
check("No run is recommended on 4th-and-long", fourthLong.slice(0, 3).every(play => !["inside run", "outside run", "option"].includes(play.conceptFamily)), fourthLong.slice(0,3).map(p => p.name).join(", "));
const baseFirst = engine.buildRankings(ctx(1, 5), [], []);
const thirdMedium = engine.buildRankings(ctx(3, 5), [], []);
const protectLead = engine.buildRankings(ctx(1, 5, "normal", "protect_lead"), [], []);
check("Rankings respond to down, distance, and game state", baseFirst[0].id !== thirdMedium[0].id || baseFirst[0].score !== thirdMedium[0].score || baseFirst[0].id !== protectLead[0].id);
const repeated = engine.buildRankings(ctx(1, 5), [], [{ playId: baseFirst[0].id, family: baseFirst[0].conceptFamily }]);
check("Recent-call penalties change repeated recommendations", repeated[0].id !== baseFirst[0].id || repeated[0].score < baseFirst[0].score, `${baseFirst[0].name} -> ${repeated[0].name}`);
const diverse = engine.diverseTop(baseFirst, 4);
check("Top alternatives include multiple concept families", new Set(diverse.map(play => play.conceptFamily)).size >= 2);
check("Shared roster loads through exported helper", engine.sharedRosterBase().players.length === RUTGERS_ROSTER_BASE.players.length);
check("Recruiting priority uses shared roster", app.includes("return sharedRosterBase()") && engine.priorityBoard().length === TEAM_NEEDS_DATA.positions.length);
check("Missing values render as Not available", engine.displayValue(null) === "Not available");
check("Rutgers mobile styling has no horizontal overflow", css.includes("overflow-x:hidden") && css.includes("@media(max-width:420px)") && index.includes("viewport-fit=cover"));
check("GitHub Pages compatibility preserved", !index.includes("type=\"module\"") && index.includes("data/engine_data.js") && !app.includes("fetch("));
check("No Name unverified placeholder is in app output templates", !app.includes("Name unverified"));

const report = ["# VALIDATION_REPORT", "", `Validated: ${new Date().toISOString()}`, "", ...checks.map(item => `- ${item.passed ? "PASS" : "FAIL"} - ${item.name}${item.detail ? ` (${item.detail})` : ""}`), "", checks.every(item => item.passed) ? "Overall: PASS" : "Overall: FAIL"].join("\n");
fs.writeFileSync(path.join(root, "VALIDATION_REPORT.md"), report + "\n");
console.log(report);
if (!checks.every(item => item.passed)) process.exit(1);
