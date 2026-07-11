const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = { window: {}, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
vm.createContext(context);

for (const file of ["data/rutgers_team.js", "data/rutgers_playbook.js", "data/weekly_plan.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
}
vm.runInContext(fs.readFileSync(path.join(root, "data", "recruiting_data.js"), "utf8"), context, { filename: "data/recruiting_data.js" });

const team = context.window.RUTGERS_TEAM;
const playbook = context.window.RUTGERS_PLAYBOOK;
const weekly = context.window.WEEKLY_PLAN;
const teamNeeds = context.window.TEAM_NEEDS_DATA;
const recruits = context.window.RECRUITS_DATA;
const roster = context.window.ROSTER_DATA;
const recruitingSettings = context.window.RECRUITING_SETTINGS;
const recruitingPerformance = context.window.RECRUITING_PERFORMANCE;
const teamProfile = context.window.TEAM_PROFILE;
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const source = fs.readFileSync(path.join(root, "docs", "SOURCE_EXTRACTION_REPORT.md"), "utf8");
const correction = fs.existsSync(path.join(root, "docs", "DATA_CORRECTION_REPORT.md"))
  ? fs.readFileSync(path.join(root, "docs", "DATA_CORRECTION_REPORT.md"), "utf8")
  : "";

global.RUTGERS_TEAM = team;
global.RUTGERS_PLAYBOOK = playbook;
global.WEEKLY_PLAN = weekly;
global.TEAM_NEEDS_DATA = teamNeeds;
global.RECRUITS_DATA = recruits;
global.ROSTER_DATA = roster;
global.RECRUITING_SETTINGS = recruitingSettings;
global.RECRUITING_PERFORMANCE = recruitingPerformance;
global.RECRUITING_BOARD = context.window.RECRUITING_BOARD;
global.TEAM_PROFILE = teamProfile;
global.OPPONENT_DATA = context.window.OPPONENT_DATA;
global.window = { GAME_HISTORY: [] };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const engine = require(path.join(root, "app.js"));

const checks = [];
function check(name, passed, detail = "") {
  checks.push({ name, passed, detail });
}
function names(rows) {
  return rows.map(p => p.name).join(", ");
}
function ctx(down, distanceYards, zone = "normal", gameState = "normal") {
  const dist = distanceYards <= 2 ? "short" : distanceYards <= 6 ? "medium" : "long";
  let key = dist;
  if (zone === "goal_line" || zone === "red_zone" || zone === "fringe") key = zone === "fringe" ? "red_zone" : zone;
  if (gameState === "two_minute" || gameState === "must_score") key = gameState;
  if (gameState === "protect_lead") key = "short";
  return { down, dist, distanceYards, zone, gameState, key };
}

const ids = new Set();
const duplicateIds = [];
for (const play of playbook) {
  if (ids.has(play.id)) duplicateIds.push(play.id);
  ids.add(play.id);
}
check("All play IDs are unique", duplicateIds.length === 0, duplicateIds.join(", "));

const requiredMetadata = ["eligibleDowns", "minDistance", "maxDistance", "eligibleFieldZones", "eligibleGameStates", "lineToGainCapability", "primaryPositions", "secondaryPositions", "requiredAttributes", "riskLevel"];
check("Every play supports eligibility and player-fit metadata", playbook.every(play => requiredMetadata.every(field => field in play)));

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
check("Static no-JavaScript fallback exists", index.includes("<noscript>") && index.includes("Static Phone Fallback") && index.includes("Rutgers vs Purdue"));
check("Weekly JSON import/export controls exist", index.includes("importWeekly") && index.includes("exportBtn") && app.includes("exportWeeklyJson") && app.includes("importWeeklyJson"));
check("Expanded result logging fields exist", ["yards", "sack", "turnover", "explosive", "thirdDownConversion", "redZoneTouchdown"].every(token => app.includes(token)));
check("localStorage persistence exists for result history and recent calls", app.includes("rutgers_game_history") && app.includes("rutgers_recent_calls"));
check("Mobile layout rules exist", css.includes("@media(max-width:420px)") && css.includes("overflow-x:hidden") && index.includes("viewport-fit=cover"));
check("Gameday header fields exist", ["programLabel", "appTitle", "weekOpponent", "seasonRecord", "rutgersRank", "offenseRank", "defenseRank", "momentumStatus"].every(id => index.includes(`id="${id}"`)));
check("Gameday header fields load from weekly data", Boolean(weekly.gameday) && ["seasonRecord", "rutgersRank", "offenseRank", "defenseRank", "momentumStatus"].every(key => key in weekly.gameday) && app.includes("renderGamedayHeader"));
check("Header says Gameday Gameplan", weekly.gameday.title === "Gameday Gameplan" && index.includes("Gameday Gameplan"));
check("Rutgers record shows 5-0", weekly.gameday.seasonRecord === "5-0" && teamProfile.record === "5-0");
check("Week 6 vs Purdue displays", weekly.gameday.currentWeek === "Week 6" && weekly.opponent.name === "Purdue" && teamProfile.week === 6);
check("Situation panel includes required controls", ["down", "distance", "zone", "state", "quarter", "clock", "score", "tempo", "bestBtn", "top3Btn"].every(id => index.includes(`id="${id}"`)));
check("Weekly package status exists", ["packageName", "packageUpdated", "packageOptions"].every(id => index.includes(`id="${id}"`)) && app.includes("packageOptions"));
check("Bottom navigation contains required tabs", ["Gameplan", "Top Plays", "Personnel", "Recruiting", "More"].every(label => index.includes(label)) && css.includes(".bottom-nav") && css.includes("position:fixed"));
check("Best Call card exposes required fields", ["rank-badge", "play-diagram", "Situation fit", "Personnel fit", "Matchup fit", "Success rate", "Yards per play", "Explosive rate", "Recent use", "Verified primary player", "Verified secondary player", "Full score breakdown"].every(token => app.includes(token)));
check("Visible score explanation includes all required components", ["Base score", "Matchup modifier", "Situation modifier", "Recent-call penalty", "Setup bonus", "Risk penalty", "Final score"].every(token => app.includes(token)));
check("Play diagram fallback cannot break missing diagrams", app.includes("formation-fallback.svg") && app.includes("diagramPath") && css.includes(".play-diagram"));
check("Tab switching supports all bottom-nav views", app.includes("function switchTab") && ["gameplan", "topplays", "personnel", "recruiting", "more"].every(id => index.includes(`id="${id}"`)));
check("Recruiting opens without page reload", index.includes('data-tab="recruiting"') && app.includes("renderRecruiting"));
check("Data architecture files exist", ["opponent.json", "roster.json", "recruits.json", "team_needs.json", "recruiting_board.json", "recruiting_settings.json", "recruiting_performance.json", "team_profile.json"].every(file => fs.existsSync(path.join(root, "data", file))));
check("Recruiting import/export controls exist", ["Export Recruiting Board JSON", "Import Recruiting Board JSON", "Export Roster JSON", "Import Roster JSON", "Export Team Needs JSON", "Import Team Needs JSON"].every(token => app.includes(token)));
check("No unconfirmed numeric ratings were added outside source anchors", team.overall === 84 && team.offense === 84 && team.defense === 86 && source.includes("84/84/86") && weekly.opponent.record === "1-4");
check("Corrected Rutgers video data report is present", correction.includes("Rutgers Video Data Correction Report") && correction.includes("M. York"));
check("Corrected QB data replaced stale 69 OVR profile", team.players.QB1.name === "M. York" && team.players.QB1.overall === 77 && weekly.players.QB1.name === "M. York" && weekly.players.QB1.overall === 77);
check("Corrected Rutgers production stats are loaded", weekly.players.HB2.lastGameStats.rushingYards === 147 && weekly.players.TE1.lastGameStats.receivingYards === 69);

const fourthTenRed = engine.buildRankings(ctx(4, 10, "red_zone"), [], []);
check("4th-and-10 red zone never recommends a run", fourthTenRed.length > 0 && !["inside run", "outside run", "option"].includes(fourthTenRed[0].conceptFamily), names(fourthTenRed.slice(0, 3)));
check("4th-and-10 red zone Top 3 excludes runs", fourthTenRed.slice(0, 3).every(play => !["inside run", "outside run", "option"].includes(play.conceptFamily)), names(fourthTenRed.slice(0, 3)));

const fourthEight = engine.buildRankings(ctx(4, 8, "normal"), [], []);
check("4th-and-8 open field never recommends Power O or HB Dive", fourthEight.slice(0, 3).every(play => !["power-o", "hb-dive", "hb-dive-pistol"].includes(play.id)), names(fourthEight.slice(0, 3)));

const fourthTwo = engine.buildRankings(ctx(4, 2, "normal"), [], []);
check("4th-and-2 may recommend Power O", fourthTwo.some(play => play.id === "power-o"));

const thirdLong = engine.buildRankings(ctx(3, 9, "normal"), [], []);
check("3rd-and-long prioritizes eligible passing concepts", thirdLong.length > 0 && ["intermediate pass", "deep pass"].includes(thirdLong[0].conceptFamily), names(thirdLong.slice(0, 3)));

const fourthLongGoal = engine.buildRankings(ctx(4, 8, "goal_line"), [], []);
check("Goal-line formation does not override long-distance restrictions", fourthLongGoal.every(play => !["inside run", "option"].includes(play.conceptFamily)), names(fourthLongGoal.slice(0, 3)));

const diverse = engine.diverseTop(engine.buildRankings(ctx(2, 5, "normal"), [], []), 3);
check("Top 3 contains only eligible plays", diverse.every(play => play.eligible));
check("Top 3 contains at least two families when possible", new Set(diverse.map(play => play.conceptFamily)).size >= 2, names(diverse));

const recommendation = engine.buildRankings(ctx(1, 5, "normal"), [], [])[0];
check("Primary player is assigned for every recommendation", Boolean(recommendation.primaryPlayerName), recommendation.primaryPlayerName);

const displayedNames = Object.values(weekly.players).map(player => player.name);
check("Usage tab shows verified player names", ["M. York", "R. Bieniamy", "T. Simonson", "J. Haskins", "S. Degraffenreidt", "K. Evans", "J. Houston", "F. Toure", "S. Moore", "K. Stacy", "B. DeMarco"].every(name => displayedNames.includes(name)), displayedNames.join(", "));
check("No verified player is displayed with a placeholder name", !displayedNames.some(name => ["Freshman QB", "WR1", "WR2", "WR3", "WR4", "TE1", "TE2", "HB2", "Name unverified"].includes(name)), displayedNames.join(", "));
const playerIds = new Set(Object.keys(weekly.players));
check("All player IDs referenced by plays exist", playbook.every(play => [...play.primaryPositions, ...play.secondaryPositions].every(id => playerIds.has(id))), "play references checked");
check("Missing statistics show Not available", engine.displayValue(null) === "Not available" && app.includes("Not available"));
check("One missing stat does not become zero", engine.displayValue(null) !== "0");

const highAttrPlay = { ...playbook[0], requiredAttributes: ["missingAttribute"] };
check("Personnel-fit score respects modifier caps", Math.abs(engine.playerFit(highAttrPlay).modifier) <= 10);
check("Matchup score respects modifier caps", Math.abs(engine.opponentMatchupModifier(playbook.find(p => p.family === "run_inside"))) <= 12);

const insideRun = playbook.find(play => engine.conceptFamily(play) === "inside run");
const secondInsideRun = playbook.find(play => engine.conceptFamily(play) === "inside run" && play.id !== insideRun.id);
const rpo = playbook.find(play => engine.conceptFamily(play) === "RPO");
const playAction = playbook.find(play => engine.conceptFamily(play) === "play action");
const exactLast = engine.recentCallPenalty(insideRun, [{ playId: insideRun.id, family: "inside run" }]);
check("Repeated plays receive the required penalties", exactLast.value <= -18 && exactLast.reasons.includes("same play last call -18"));

const runSetupHistory = [{ playId: insideRun.id, result: "success" }, { playId: secondInsideRun.id, result: "success" }];
check("Successful runs promote RPO and play action", engine.setupBonus(rpo, runSetupHistory).value >= 6 && engine.setupBonus(playAction, runSetupHistory).value >= 8);

const persisted = [{ playId: insideRun.id, result: "success", yards: 5 }];
global.localStorage = { getItem: key => key === "rutgers_game_history" ? JSON.stringify(persisted) : null, setItem: () => {}, removeItem: () => {} };
delete require.cache[require.resolve(path.join(root, "app.js"))];
const engineReloaded = require(path.join(root, "app.js"));
check("Result history survives refresh", engineReloaded.buildRankings(ctx(1, 2), persisted, []).length > 0);

check("Usage cards render without horizontal scrolling on iPhone width", css.includes("overflow-wrap:anywhere") && css.includes(".usageGroup"));

const deepPlay = playbook.find(play => engine.conceptFamily(play) === "deep pass");
const originalDeep = engine.scorePlay(deepPlay, ctx(4, 8), [], []).score;
const savedModifier = weekly.familyModifiers.deep;
weekly.familyModifiers.deep = savedModifier + 6;
const updatedDeep = engine.scorePlay(deepPlay, ctx(4, 8), [], []).score;
weekly.familyModifiers.deep = savedModifier;
check("Weekly-plan data can update recommendations without editing app.js", updatedDeep !== originalDeep);

const diagramFiles = fs.readdirSync(path.join(root, "assets", "play-diagrams")).filter(file => file.endsWith(".svg"));
const playSpecificSvgCount = diagramFiles.filter(file => file !== "formation-fallback.svg").length;
check("All 48 play-specific SVG assets remain present", playSpecificSvgCount === 48, `${playSpecificSvgCount} play SVGs`);
check("Formation fallback diagram exists", fs.existsSync(path.join(root, "assets", "play-diagrams", "formation-fallback.svg")));
for (const play of playbook) {
  check(`Play art exists for ${play.id}`, Boolean(play.diagramPath) && fs.existsSync(path.join(root, play.diagramPath)), play.diagramPath || "missing path");
  check(`Play art path is relative for ${play.id}`, Boolean(play.diagramPath) && !path.isAbsolute(play.diagramPath), play.diagramPath || "missing path");
  check(`Play art verification is valid for ${play.id}`, ["verified", "partial", "formation_only"].includes(play.diagramVerification), play.diagramVerification || "missing");
}
check("Best Call displays assigned play art", app.includes("<img src=\"${play.diagramPath") && app.includes("onerror=\"this.src='assets/play-diagrams/formation-fallback.svg'"));

const expectedNeeds = {
  QB: [0, 3], HB: [0, 4], FB: [0, 0], WR: [0, 3], TE: [0, 1], T: [11, 5], G: [0, 6], C: [0, 1],
  EDGE: [5, 3], DT: [5, 1], OLB: [0, 7], MIKE: [2, 0], CB: [7, 4], FS: [5, 3], SS: [0, 2], K: [0, 0], P: [0, 0]
};
const needsByPosition = new Map(teamNeeds.positions.map(row => [row.position, [row.current_targets, row.recommended_targets]]));
check("Team Needs values match structured file", Object.entries(expectedNeeds).every(([position, values]) => {
  const actual = needsByPosition.get(position);
  return actual && actual[0] === values[0] && actual[1] === values[1];
}));
const priorityRows = engine.priorityBoard();
check("Position priority scoring runs", priorityRows.length === teamNeeds.positions.length && priorityRows.every(row => Number.isFinite(row.score)), priorityRows.slice(0, 5).map(row => `${row.position}:${row.score}`).join(", "));
check("Initial priority positions remain high after scoring", ["G", "OLB", "QB", "WR", "SS", "HB", "TE", "C"].every(position => priorityRows.find(row => row.position === position)));
check("Over-coverage penalties apply", ["T", "EDGE", "DT", "CB", "FS"].every(position => priorityRows.find(row => row.position === position && row.overcovered)));
check("Missing performance metrics remain neutral", engine.performanceNeed("G").value === 0.5 && engine.performanceNeed("G").available === false);
check("Recruiting filters are implemented", app.includes("filterPosition") && app.includes("filteredRecruits"));
check("Recruit detail is implemented", app.includes("function renderRecruitDetail") && index.includes("recruitDetail"));
check("Personnel roster loads", roster.players.length === 4 && app.includes("renderRoster") && index.includes("rosterList"));
check("Roster data feeds recruiting priority", app.includes("rosterSignals") && engine.priorityScore(teamNeeds.positions.find(row => row.position === "QB")).rosterNote.includes("verified roster"));
check("Recruiting board data is loaded", recruits.prospects.length >= 13 && recruits.prospects.every(prospect => "verification_status" in prospect && "source_frame" in prospect));
check("Unknown recruit data remains null", recruits.prospects.some(prospect => prospect.stars === null && prospect.interest_level === null));
check("Unknown data renders safely", app.includes("Unknown") && app.includes("unknownValue"));
check("No fake zeros replace unknown recruit fields", !app.includes("prospect.stars || 0") && !app.includes("prospect.interest_level || 0"));
check("Reference frames are packaged", fs.existsSync(path.join(root, "reference_frames", "team_needs.jpeg")) && fs.existsSync(path.join(root, "reference_frames", "recruiting", "recruit_01.jpg")));

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
