const $ = id => document.getElementById(id);
const HISTORY_KEY = "rutgers_game_history";
const WEEKLY_KEY = "rutgers_weekly_package";
const GAMEPLAN_WEEKLY_KEY = "rutgers_gameplan_weekly_v2";
const RECRUITING_WEEKLY_KEY = "rutgers_recruiting_weekly_v2";
const RECENT_CALLS_KEY = "rutgers_recent_calls";
const REQUIRED_SITUATIONS = ["short", "medium", "long", "red_zone", "goal_line", "two_minute", "normal", "must_score"];
const DEFAULT_CAPS = {
  personnelFit: [-10, 10],
  opponentMatchup: [-12, 12],
  seasonProduction: [-8, 8],
  recentGameForm: [-6, 6],
  situationFit: [-20, 20],
  setupBonus: [-10, 10],
  recentCallDiversity: [-18, 0],
  riskPenalty: [-15, 0]
};
const state = { ranked: [], excluded: [] };

function loadLocalWeeklyPackage() {
  const saved = localStorage.getItem(WEEKLY_KEY);
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    validateWeeklyPlan(parsed);
    window.WEEKLY_PLAN = parsed;
  } catch (err) {
    localStorage.removeItem(WEEKLY_KEY);
    setStatus(`Ignored invalid saved weekly package: ${err.message}`);
  }
}

function loadEnginePackages() {
  try {
    const savedGameplan = localStorage.getItem(GAMEPLAN_WEEKLY_KEY);
    if (savedGameplan) {
      const parsed = JSON.parse(savedGameplan);
      validateGameplanWeekly(parsed);
      window.GAMEPLAN_WEEKLY = parsed;
    }
  } catch (err) {
    localStorage.removeItem(GAMEPLAN_WEEKLY_KEY);
    setStatus(`Ignored invalid saved gameplan package: ${err.message}`);
  }
  try {
    const savedRecruiting = localStorage.getItem(RECRUITING_WEEKLY_KEY);
    if (savedRecruiting) {
      const parsed = JSON.parse(savedRecruiting);
      validateRecruitingWeekly(parsed);
      window.RECRUITING_WEEKLY = parsed;
    }
  } catch (err) {
    localStorage.removeItem(RECRUITING_WEEKLY_KEY);
    setStatus(`Ignored invalid saved recruiting package: ${err.message}`);
  }
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    localStorage.removeItem(HISTORY_KEY);
    return [];
  }
}

function saveHistory(rows) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(rows));
  window.GAME_HISTORY = rows;
}

function loadRecentCalls() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_CALLS_KEY) || "[]").slice(-8);
  } catch {
    localStorage.removeItem(RECENT_CALLS_KEY);
    return [];
  }
}

function saveRecentCalls(rows) {
  localStorage.setItem(RECENT_CALLS_KEY, JSON.stringify(rows.slice(-8)));
}

function distanceYardsFromSelect(value) {
  if (value === "short") return 2;
  if (value === "medium") return 5;
  if (value === "long") return 8;
  return Number(value) || 5;
}

function situationContext() {
  const down = Number($("down").value);
  const dist = $("distance").value;
  const zone = $("zone").value;
  const gameState = $("state").value;
  let key = dist;
  if (zone === "goal_line" || zone === "red_zone") key = zone;
  if (zone === "fringe") key = "red_zone";
  if (zone === "backed_up") key = "normal";
  if (gameState === "two_minute" || gameState === "must_score") key = gameState;
  if (gameState === "protect_lead") key = "short";
  return { down, dist, distanceYards: distanceYardsFromSelect(dist), zone, gameState, key };
}

function situationKey() {
  return situationContext().key;
}

function playMap() {
  return new Map(RUTGERS_PLAYBOOK.map(play => [play.id, play]));
}

function weeklyPlayers() {
  return (WEEKLY_PLAN && WEEKLY_PLAN.players) || (RUTGERS_TEAM && RUTGERS_TEAM.players) || {};
}

function caps() {
  return { ...DEFAULT_CAPS, ...(WEEKLY_PLAN.modifierCaps || {}) };
}

function cap(value, key) {
  const [min, max] = caps()[key] || [-99, 99];
  return Math.max(min, Math.min(max, value));
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function scoreLetter(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return "";
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

function displayGrade(value, fallbackScore = "") {
  return cleanValue(value) || scoreLetter(fallbackScore);
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "";
  if (typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== "");
    return entries.length ? entries.map(([k, v]) => `${labelize(k)}: ${v}`).join("; ") : "";
  }
  return String(value);
}

function unknownValue(value) {
  if (value === null || value === undefined || value === "") return "Unknown";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Unknown";
  return String(value);
}

function setText(id, value) {
  const node = $(id);
  if (node) node.textContent = displayValue(value);
}

function labelize(text) {
  return String(text).replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
}

function validateWeeklyPlan(plan) {
  if (!plan || !plan.opponent || !plan.opponent.name) throw new Error("Missing opponent name");
  if (!Array.isArray(plan.openingScript)) throw new Error("Missing openingScript");
  if (plan.openingScript.length !== 12) throw new Error("Opening script must contain 12 plays");
  const ids = new Set(RUTGERS_PLAYBOOK.map(play => play.id));
  const seen = new Set();
  for (const id of plan.openingScript) {
    if (!ids.has(id)) throw new Error(`Opening script play ID not found: ${id}`);
    if (seen.has(id)) throw new Error(`Opening script duplicate ID: ${id}`);
    seen.add(id);
  }
  for (const key of ["familyModifiers", "riskRules", "traits", "warnings", "players", "opponent"]) {
    if (!(key in plan)) throw new Error(`Missing weekly field: ${key}`);
  }
  return true;
}

function validateGameplanWeekly(plan) {
  if (!plan || typeof plan !== "object") throw new Error("Gameplan package must be an object");
  if (plan.schema_version !== "2.0") throw new Error("Gameplan package must use schema_version 2.0");
  if (plan.package_type !== "gameplan_weekly_update") throw new Error("Wrong package_type for gameplan import");
  if (plan.shared_roster_file !== "data/rutgers_roster_base.json") throw new Error("Gameplan package must reference shared roster base");
  if (!plan.package_name || !plan.opponent) throw new Error("Gameplan package requires package_name and opponent");
  return true;
}

function validateRecruitingWeekly(plan) {
  if (!plan || typeof plan !== "object") throw new Error("Recruiting package must be an object");
  if (plan.schema_version !== "2.0") throw new Error("Recruiting package must use schema_version 2.0");
  if (plan.package_type !== "recruiting_weekly_update") throw new Error("Wrong package_type for recruiting import");
  if (plan.shared_roster_file !== "data/rutgers_roster_base.json") throw new Error("Recruiting package must reference shared roster base");
  if (!Array.isArray(plan.recruiting_priority_order)) throw new Error("Recruiting package requires recruiting_priority_order[]");
  return true;
}

function validatePlaybook() {
  const ids = new Set();
  const covered = new Set();
  for (const play of RUTGERS_PLAYBOOK) {
    if (!play.id || ids.has(play.id)) throw new Error(`Duplicate or missing play ID: ${play.id}`);
    ids.add(play.id);
    for (const field of ["eligibleDowns", "minDistance", "maxDistance", "eligibleFieldZones", "eligibleGameStates", "lineToGainCapability", "primaryPositions", "secondaryPositions", "requiredAttributes", "riskLevel"]) {
      if (!(field in play)) throw new Error(`Missing play metadata ${field}: ${play.id}`);
    }
    for (const sit of play.situations || []) covered.add(sit);
  }
  const missing = REQUIRED_SITUATIONS.filter(sit => !covered.has(sit));
  if (missing.length) throw new Error(`Missing situation coverage: ${missing.join(", ")}`);
}

function conceptFamily(play) {
  if (play.conceptFamily) return play.conceptFamily;
  const family = play.family;
  if (family === "run_inside") return "inside run";
  if (family === "run_outside" || family === "outside_run") return "outside run";
  if (family === "option") return "option";
  if (family === "rpo") return "RPO";
  if (family === "quick") return "quick pass";
  if (family === "intermediate" || family === "red_zone_pass") return "intermediate pass";
  if (family === "deep") return "deep pass";
  if (family === "screen") return "screen";
  if (family === "play_action") return "play action";
  return family ? family.replaceAll("_", " ") : "unknown";
}

function canReachLineToGain(play, distanceYards) {
  if (play.lineToGainCapability === "long") return true;
  if (play.lineToGainCapability === "medium") return distanceYards <= 6;
  if (play.lineToGainCapability === "short") return distanceYards <= 2;
  return distanceYards <= play.maxDistance;
}

function eligibility(play, context) {
  const reasons = [];
  const family = conceptFamily(play);
  const name = play.name.toLowerCase();
  if (!play.eligibleDowns.includes(context.down)) reasons.push("Excluded: not valid on this down");
  if (context.distanceYards < play.minDistance || context.distanceYards > play.maxDistance) reasons.push("Excluded: exceeds maximum recommended distance");
  if (!play.eligibleFieldZones.includes(context.zone)) reasons.push("Excluded: field-zone mismatch");
  if (!play.eligibleGameStates.includes(context.gameState)) reasons.push("Excluded: game-state mismatch");
  if (!canReachLineToGain(play, context.distanceYards)) reasons.push("Excluded: cannot reach line to gain");

  if (context.down === 4 && context.distanceYards <= 2) {
    if (!["inside run", "RPO", "option", "quick pass", "play action"].includes(family)) reasons.push("Excluded: not valid on this down");
  }
  if (context.down === 4 && context.distanceYards >= 3 && context.distanceYards <= 6) {
    const allowed = family === "quick pass" || family === "RPO" || family === "intermediate pass" || family === "play action" || name.includes("mesh") || name.includes("stick") || name.includes("spacing") || name.includes("sprint");
    if (!allowed) reasons.push("Excluded: not valid on this down");
  }
  if (context.down === 4 && context.distanceYards >= 7) {
    if (!["intermediate pass", "deep pass"].includes(family)) reasons.push("Excluded: not valid on this down");
    if (!canReachLineToGain(play, context.distanceYards)) reasons.push("Excluded: cannot reach line to gain");
  }
  if (context.down === 4 && context.distanceYards > 7 && family === "screen") reasons.push("Excluded: exceeds maximum recommended distance");
  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)] };
}

function ratingModifier(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  return ((Number(value) - 80) / 10) * 5;
}

function availableAverage(values) {
  const usable = values.filter(v => v !== null && v !== undefined && !Number.isNaN(Number(v)));
  if (!usable.length) return null;
  return usable.reduce((sum, value) => sum + Number(value), 0) / usable.length;
}

function playerAttributeScore(player, attrs) {
  const values = attrs.map(attr => player.attributes ? player.attributes[attr] : null);
  const avg = availableAverage(values);
  return avg === null ? 0 : ratingModifier(avg);
}

function productionModifier(player, sourceKey, capKey) {
  const stats = player[sourceKey] || {};
  const ypc = stats.yardsPerCarry;
  const ypt = stats.yardsPerTarget;
  const catchRate = stats.catchRate;
  const values = [];
  if (ypc !== null && ypc !== undefined) values.push((Number(ypc) - 4) * 2);
  if (ypt !== null && ypt !== undefined) values.push((Number(ypt) - 7) * 1.2);
  if (catchRate !== null && catchRate !== undefined) values.push((Number(catchRate) - 0.6) * 10);
  const avg = availableAverage(values);
  return cap(avg === null ? 0 : avg, capKey);
}

function playerFit(play) {
  const players = weeklyPlayers();
  const candidates = [...(play.primaryPositions || []), ...(play.secondaryPositions || [])]
    .map(id => players[id])
    .filter(Boolean);
  let best = null;
  for (const player of candidates) {
    const attr = playerAttributeScore(player, play.requiredAttributes || []);
    const season = productionModifier(player, "seasonStats", "seasonProduction");
    const recent = productionModifier(player, "lastGameStats", "recentGameForm");
    const conceptBoost = (player.bestConcepts || []).includes(conceptFamily(play)) ? 2 : 0;
    const score = attr + season + recent + conceptBoost;
    if (!best || score > best.score) best = { player, score, attr, season, recent, conceptBoost };
  }
  if (!best) {
    const fallback = { id: "TEAM", name: "Team personnel", position: "Team", weeklyRole: "Best available personnel", priorityLabel: "Situational" };
    best = { player: fallback, score: 0, attr: 0, season: 0, recent: 0, conceptBoost: 0 };
  }
  const secondaryId = (play.secondaryPositions || []).find(id => players[id] && players[id].id !== best.player.id);
  const secondary = secondaryId ? players[secondaryId] : null;
  return {
    primaryPlayer: best.player,
    secondaryPlayer: secondary,
    modifier: cap(best.score, "personnelFit"),
    seasonModifier: cap(best.season, "seasonProduction"),
    recentModifier: cap(best.recent, "recentGameForm"),
    rationale: best.player.name === "Team personnel" ? "Use the best verified personnel grouping for this call." : `${best.player.name} fits ${conceptFamily(play)} through weekly role and available attributes.`
  };
}

function opponentMatchupModifier(play) {
  return cap(WEEKLY_PLAN.familyModifiers[play.family] || 0, "opponentMatchup");
}

function recentCallPenalty(play, recentCalls = loadRecentCalls()) {
  const last = recentCalls.slice(-8).reverse();
  const exactIndex = last.findIndex(call => call.playId === play.id);
  let penalty = 0;
  const reasons = [];
  if (exactIndex === 0) {
    penalty -= 18;
    reasons.push("same play last call -18");
  } else if (exactIndex > 0 && exactIndex < 3) {
    penalty -= 10;
    reasons.push("same play within last 3 -10");
  } else if (exactIndex >= 3 && exactIndex < 6) {
    penalty -= 5;
    reasons.push("same play within last 6 -5");
  }
  const family = conceptFamily(play);
  if (last[0] && last[0].family === family) {
    penalty -= 8;
    reasons.push("same family consecutive -8");
  }
  if (last.slice(0, 5).filter(call => call.family === family).length >= 3) {
    penalty -= 6;
    reasons.push("same family 3 of last 5 -6");
  }
  return { value: cap(penalty, "recentCallDiversity"), reasons };
}

function setupBonus(play, history = window.GAME_HISTORY || []) {
  const byId = playMap();
  const lastFive = history.slice(-5);
  const family = conceptFamily(play);
  let bonus = 0;
  const reasons = [];
  const successfulInsideRuns = lastFive.filter(row => row.result === "success" && conceptFamily(byId.get(row.playId) || {}) === "inside run").length;
  if (successfulInsideRuns >= 2 && family === "play action") { bonus += 8; reasons.push("two successful inside runs -> play action +8"); }
  if (successfulInsideRuns >= 2 && family === "RPO") { bonus += 6; reasons.push("two successful inside runs -> RPO +6"); }
  if (lastFive.some(row => row.result === "success" && conceptFamily(byId.get(row.playId) || {}) === "screen")) {
    if (family === "inside run") { bonus += 3; reasons.push("successful screen -> inside run +3"); }
    if (family === "intermediate pass") { bonus += 3; reasons.push("successful screen -> intermediate pass +3"); }
  }
  if (lastFive.some(row => row.result === "success" && conceptFamily(byId.get(row.playId) || {}) === "quick pass") && family === "deep pass") {
    bonus += 4; reasons.push("successful quick pass -> deep shot +4");
  }
  if (lastFive.some(row => row.sack || (row.result === "failure" && conceptFamily(byId.get(row.playId) || {}) === "deep pass"))) {
    if (family === "deep pass") { bonus -= 8; reasons.push("failed deep pass or sack -> deep pass -8"); }
    if (family === "quick pass") { bonus += 5; reasons.push("failed deep pass or sack -> quick pass +5"); }
    if (family === "screen") { bonus += 5; reasons.push("failed deep pass or sack -> screen +5"); }
  }
  return { value: cap(bonus, "setupBonus"), reasons };
}

function situationModifier(play, context, history = window.GAME_HISTORY || []) {
  const family = conceptFamily(play);
  const name = `${play.name} ${play.formation}`.toLowerCase();
  let modifier = 0;
  const reasons = [];
  if (play.situations.includes(context.key)) { modifier += 5; reasons.push(`${context.key} fit +5`); }
  if ((context.zone === "red_zone" || context.zone === "fringe") && play.situations.includes("red_zone")) {
    const redZoneBonus = Math.min(8, context.distanceYards <= 3 ? 6 : (["intermediate pass", "deep pass", "RPO", "play action"].includes(family) ? 4 : 0));
    modifier += redZoneBonus;
    if (redZoneBonus) reasons.push(`red zone capped bonus +${redZoneBonus}`);
  }
  if (context.zone === "goal_line" && context.distanceYards <= 3 && play.situations.includes("goal_line")) { modifier += 8; reasons.push("goal line short-yardage +8"); }
  if (context.down === 1 && ["inside run", "quick pass", "RPO", "play action", "screen"].includes(family)) { modifier += 3; reasons.push("1st down balanced call +3"); }
  if (context.down === 2 && context.distanceYards <= 2 && ["deep pass", "play action", "intermediate pass"].includes(family)) { modifier += 5; reasons.push("2nd and short controlled shot +5"); }
  if (context.down === 3 && context.distanceYards >= 3 && context.distanceYards <= 6 && ["quick pass", "intermediate pass", "RPO"].includes(family)) { modifier += 7; reasons.push("3rd and medium quick/intermediate/RPO +7"); }
  if ((context.zone === "red_zone" || context.zone === "fringe") && (name.includes("boot") || name.includes("mtn") || name.includes("power") || family === "RPO")) {
    const amount = context.distanceYards <= 3 || family !== "inside run" ? 3 : 0;
    modifier += amount;
    if (amount) reasons.push("red zone condensed/motion/RPO/boot/power +3");
  }
  if (context.gameState === "protect_lead") {
    if (["inside run", "outside run", "quick pass", "screen", "RPO"].includes(family)) { modifier += 5; reasons.push("protect lead low-risk run/quick +5"); }
    if (family === "deep pass") { modifier -= 8; reasons.push("protect lead deep pass -8"); }
  }
  if (context.gameState === "must_score") {
    if (["deep pass", "intermediate pass", "play action"].includes(family)) { modifier += 4; reasons.push("must score expands attack +4"); }
    if (family === "inside run") { modifier -= 2; reasons.push("must score reduces conservative run -2"); }
  }
  const sacks = history.filter(row => row.sack).length;
  if (sacks >= 2 && ["quick pass", "screen", "play action"].includes(family)) { modifier += 5; reasons.push("two sacks -> quick/screen/movement +5"); }
  return { value: cap(modifier, "situationFit"), reasons };
}

function riskPenalty(play, context, history = window.GAME_HISTORY || []) {
  let penalty = 0;
  const family = conceptFamily(play);
  const risk = play.riskLevel || WEEKLY_PLAN.riskRules[play.family] || "medium";
  const sacks = history.filter(row => row.sack).length;
  const turnovers = history.filter(row => row.turnover).length;
  if (risk === "high") penalty -= context.gameState === "must_score" ? 4 : 8;
  if (context.gameState === "protect_lead" && !["inside run", "outside run", "quick pass", "screen", "RPO"].includes(family)) penalty -= 4;
  if (sacks >= 2 && family === "deep pass") penalty -= 7;
  if (turnovers > 0 && risk === "high") penalty -= 4;
  return { value: cap(penalty, "riskPenalty"), reasons: penalty ? [`risk adjustment ${penalty}`] : [] };
}

function weeklyGameplanData() {
  return typeof GAMEPLAN_WEEKLY !== "undefined" ? GAMEPLAN_WEEKLY : {};
}

function sharedRosterBase() {
  return typeof RUTGERS_ROSTER_BASE !== "undefined" ? RUTGERS_ROSTER_BASE : { players: [], position_groups: [] };
}

function sharedRosterMatch(player) {
  if (!player || !player.name) return null;
  const wanted = player.name.toLowerCase().replace(/\s+/g, " ").trim();
  return (sharedRosterBase().players || []).find(row => String(row.display_name || "").toLowerCase().replace(/\s+/g, " ").trim() === wanted) || null;
}

function extendedGameplanModifier(play, context, personnel) {
  const weekly = weeklyGameplanData();
  const family = conceptFamily(play);
  let value = 0;
  const reasons = [];
  const runFits = weekly.run_direction || [];
  const protectionFits = weekly.protection || [];
  const matrix = weekly.matchup_matrix || [];
  if (family === "inside run" && runFits.some(row => String(row.direction || "").toLowerCase().includes("inside"))) {
    value += 1.5;
    reasons.push("run-direction fit +1.5");
  }
  if (["quick pass", "screen", "play action"].includes(family) && protectionFits.length) {
    value += family === "play action" ? 0.5 : 1.5;
    reasons.push("protection-plan fit +" + (family === "play action" ? "0.5" : "1.5"));
  }
  if (matrix.some(row => String(row.rutgers || "").toLowerCase().includes("te")) && personnel.primaryPlayer && personnel.primaryPlayer.position === "TE") {
    value += 1;
    reasons.push("matchup matrix TE fit +1");
  }
  if (context.gameState === "protect_lead" && ["inside run", "quick pass", "screen", "RPO"].includes(family)) {
    value += 1;
    reasons.push("usage plan lead-protection fit +1");
  }
  return { value: cap(value, "situationFit"), reasons };
}

function scorePlay(play, context = situationContext(), history = window.GAME_HISTORY || [], recentCalls = loadRecentCalls()) {
  const check = eligibility(play, context);
  if (!check.eligible) return { ...play, eligible: false, exclusionReasons: check.reasons };
  const personnel = playerFit(play);
  const matchup = opponentMatchupModifier(play);
  const setup = setupBonus(play, history);
  const recent = recentCallPenalty(play, recentCalls);
  const situation = situationModifier(play, context, history);
  const risk = riskPenalty(play, context, history);
  const extended = extendedGameplanModifier(play, context, personnel);
  const rosterRecord = sharedRosterMatch(personnel.primaryPlayer);
  const finalScore = clampScore(play.baseScore + personnel.modifier + matchup + personnel.seasonModifier + personnel.recentModifier + situation.value + setup.value + recent.value + risk.value + extended.value);
  const secondaryName = personnel.secondaryPlayer ? personnel.secondaryPlayer.name : "";
  return {
    ...play,
    eligible: true,
    conceptFamily: conceptFamily(play),
    primaryPlayer: personnel.primaryPlayer,
    secondaryPlayer: personnel.secondaryPlayer,
    primaryPlayerName: personnel.primaryPlayer.name,
    secondaryPlayerName: secondaryName,
    targetAssignment: targetAssignment(play, personnel.primaryPlayer),
    workloadRole: personnel.primaryPlayer.weeklyRole || "",
    matchupRationale: matchupRationale(play, personnel),
    baseScore: play.baseScore,
    personnelFit: personnel.modifier,
    matchupModifier: matchup,
    seasonModifier: personnel.seasonModifier,
    recentFormModifier: personnel.recentModifier,
    situationModifier: situation.value,
    situationReasons: situation.reasons,
    setupBonus: setup.value,
    setupReasons: setup.reasons,
    recentCallPenalty: recent.value,
    recentCallReasons: recent.reasons,
    riskPenalty: risk.value,
    riskReasons: risk.reasons,
    extendedGameplanModifier: extended.value,
    extendedGameplanReasons: extended.reasons,
    sharedRosterPlayerId: rosterRecord ? rosterRecord.player_id : null,
    score: finalScore,
    risk: play.riskLevel || WEEKLY_PLAN.riskRules[play.family] || "medium",
    objective: play.objective || objectiveFor(play)
  };
}

function targetAssignment(play, player) {
  const family = conceptFamily(play);
  if (["inside run", "outside run", "screen", "option", "RPO"].includes(family)) return `Feature ${player.name} as ball-carrier or primary read.`;
  return `Feature ${player.name} as primary target or quarterback operator.`;
}

function matchupRationale(play, personnel) {
  const family = conceptFamily(play);
  const groups = typeof loadOpponentGroups === "function" ? loadOpponentGroups() : [];
  const risk = typeof highestRiskMatchup === "function" ? highestRiskMatchup() : {};
  const interior = groups.find(g => /interior|tackle|defensive/i.test(cleanValue(g.group))) || {};
  const linebackers = groups.find(g => /linebacker/i.test(cleanValue(g.group))) || {};
  if (family === "inside run") return `${personnel.primaryPlayer.name} fits the interior plan. ${cleanValue(interior.attack_plan || interior.weakness) || "Use the current opponent group data for the final run call."}`;
  if (family === "quick pass" || family === "screen") return `${personnel.primaryPlayer.name} gives a faster answer against ${cleanValue(risk.opponent_player) || "the highest-risk pressure matchup"}.`;
  if (family === "intermediate pass" || family === "RPO") return `${personnel.primaryPlayer.name} helps attack ${cleanValue(linebackers.group) || "the second-level matchup"}. ${cleanValue(linebackers.attack_plan)}`;
  if (family === "deep pass") return `${personnel.primaryPlayer.name} is the best available deep-shot assignment from verified weekly data.`;
  return personnel.rationale;
}

function objectiveFor(play) {
  if (play.situations.includes("goal_line") || play.situations.includes("red_zone")) return "red-zone score";
  if (conceptFamily(play) === "deep pass") return "explosive opportunity";
  if (["inside run", "quick pass", "RPO"].includes(conceptFamily(play))) return "move chains";
  return "pressure answer";
}

function buildRankings(context = situationContext(), history = window.GAME_HISTORY || [], recentCalls = loadRecentCalls()) {
  const scored = RUTGERS_PLAYBOOK.map(play => scorePlay(play, context, history, recentCalls));
  state.excluded = scored.filter(play => !play.eligible);
  return scored.filter(play => play.eligible).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function diverseTop(ranked, count = 3) {
  if (count === 1) return ranked.slice(0, 1);
  const familyCount = new Set(ranked.map(play => play.conceptFamily)).size;
  if (familyCount < 3) return ranked.slice(0, count);
  const picks = [];
  for (const play of ranked) {
    if (picks.length < 2 && picks.some(pick => pick.conceptFamily === play.conceptFamily)) continue;
    picks.push(play);
    if (picks.length === count) break;
  }
  for (const play of ranked) {
    if (picks.length === count) break;
    if (!picks.some(pick => pick.id === play.id)) picks.push(play);
  }
  if (new Set(picks.map(play => play.conceptFamily)).size === 1) {
    const different = ranked.find(play => play.conceptFamily !== picks[0].conceptFamily);
    if (different) picks[picks.length - 1] = different;
  }
  return picks;
}

function rank() {
  state.ranked = buildRankings();
  renderRanks();
}

function renderRanks() {
  if (!$("rankList")) return;
  const q = $("search") ? $("search").value.toLowerCase() : "";
  const family = $("rankFamily") ? $("rankFamily").value : "all";
  const formation = $("rankFormation") ? $("rankFormation").value : "all";
  const list = state.ranked.filter(play => {
    if (family !== "all" && play.conceptFamily !== family) return false;
    if (formation !== "all" && play.formation !== formation) return false;
    return !q || play.name.toLowerCase().includes(q) || play.formation.toLowerCase().includes(q) || play.primaryPlayerName.toLowerCase().includes(q);
  });
  $("rankList").innerHTML = list.map((play, i) => callCard(play, i + 1)).join("");
}

function populateRankFilters() {
  if ($("rankFamily")) {
    const families = [...new Set(RUTGERS_PLAYBOOK.map(play => conceptFamily(play)))].sort();
    $("rankFamily").innerHTML = `<option value="all">All</option>${families.map(row => `<option value="${row}">${row}</option>`).join("")}`;
  }
  if ($("rankFormation")) {
    const formations = [...new Set(RUTGERS_PLAYBOOK.map(play => play.formation))].sort();
    $("rankFormation").innerHTML = `<option value="all">All</option>${formations.map(row => `<option value="${row}">${row}</option>`).join("")}`;
  }
}

function scoreBreakdown(play) {
  return `<div class="breakdown">
    <span>Base score ${play.baseScore}</span>
    <span>Matchup modifier ${signed(play.matchupModifier)}</span>
    <span>Situation modifier ${signed(play.situationModifier)}</span>
    <span>Personnel fit ${signed(play.personnelFit)}</span>
    <span>Season production ${signed(play.seasonModifier)}</span>
    <span>Recent form ${signed(play.recentFormModifier)}</span>
    <span>Weekly plan fit ${signed(play.extendedGameplanModifier || 0)}</span>
    <span>Recent-call penalty ${signed(play.recentCallPenalty)}</span>
    <span>Setup bonus ${signed(play.setupBonus)}</span>
    <span>Risk penalty ${signed(play.riskPenalty)}</span>
    <strong>Final score ${play.score}</strong>
  </div>`;
}

function explanationText(play) {
  const bits = [
    `${play.name} ranks here because it is eligible for the selected down, distance, field zone and game state.`,
    play.matchupRationale,
    ...play.situationReasons,
    ...(play.extendedGameplanReasons || []),
    ...play.setupReasons,
    ...play.recentCallReasons,
    ...play.riskReasons
  ].filter(Boolean);
  return bits.join(" ");
}

function signed(value) {
  return value > 0 ? `+${Math.round(value * 10) / 10}` : `${Math.round(value * 10) / 10}`;
}

function callCard(play, rankNumber) {
  return `<div class="call">
    <div class="rank">${rankNumber}</div>
    <div>
      <h3>${play.name}</h3>
      <div class="small">${play.formation} / ${play.conceptFamily}</div>
      <div class="small">Primary: ${play.primaryPlayerName} | Secondary: ${play.secondaryPlayerName}</div>
      <div class="small">Objective: ${play.objective} | ${play.targetAssignment}</div>
      ${scoreBreakdown(play)}
      <div class="small">${explanationText(play)}</div>
      <div class="log-grid">
        <label>Yards <input id="yards-${play.id}" type="number" inputmode="numeric" value="0"></label>
        <label><input id="sack-${play.id}" type="checkbox"> Sack</label>
        <label><input id="turnover-${play.id}" type="checkbox"> Turnover</label>
        <label><input id="explosive-${play.id}" type="checkbox"> Explosive</label>
        <label><input id="third-${play.id}" type="checkbox"> 3rd Conv</label>
        <label><input id="redzone-${play.id}" type="checkbox"> RZ TD</label>
      </div>
      <div class="result-row">
        <button onclick="record('${play.id}','success')">Success</button>
        <button onclick="record('${play.id}','neutral')">Neutral</button>
        <button onclick="record('${play.id}','failure')">Failure</button>
      </div>
    </div>
    <div><div class="score">${play.score}</div><span class="risk ${play.risk}">${play.risk}</span></div>
  </div>`;
}

function markCalled(plays) {
  const rows = loadRecentCalls();
  const now = new Date().toISOString();
  for (const play of plays) rows.push({ timestamp: now, opponent: WEEKLY_PLAN.opponent.name, playId: play.id, family: play.conceptFamily });
  saveRecentCalls(rows);
}

function playHistoryMetrics(play) {
  const rows = loadHistory().filter(row => row.playId === play.id);
  if (!rows.length) {
    return {
      successRate: "",
      yardsPerPlay: "",
      explosiveRate: "",
      recentUse: loadRecentCalls().filter(row => row.playId === play.id).length ? "Used recently" : ""
    };
  }
  const successRate = `${Math.round((rows.filter(row => row.result === "success").length / rows.length) * 100)}%`;
  const yardsRows = rows.filter(row => row.yards !== null && row.yards !== undefined && !Number.isNaN(Number(row.yards)));
  const yardsPerPlay = yardsRows.length ? (yardsRows.reduce((sum, row) => sum + Number(row.yards), 0) / yardsRows.length).toFixed(1) : "";
  const explosiveRate = `${Math.round((rows.filter(row => row.explosive).length / rows.length) * 100)}%`;
  const recentUses = loadRecentCalls().filter(row => row.playId === play.id).length;
  return { successRate, yardsPerPlay, explosiveRate, recentUse: recentUses ? `${recentUses} in last 8 calls` : "No recent calls" };
}

function bestCallCard(play, rankNumber, label) {
  const metrics = playHistoryMetrics(play);
  return `<article class="${rankNumber > 1 ? "altPick" : ""}">
    <div class="best-head">
      <div class="rank-badge">${rankNumber}</div>
      <div>
        <div class="card-label">${label}</div>
        <h2>${play.name}</h2>
        <div class="play-meta">
          <span class="chip">${play.formation}</span>
          <span class="chip">${play.conceptFamily}</span>
          <span class="risk ${play.risk}">${play.risk} risk</span>
        </div>
      </div>
      <div class="score">${play.score}<span>Overall</span></div>
    </div>
    <figure class="play-diagram">
      <img src="${play.diagramPath || 'assets/play-diagrams/formation-fallback.svg'}" alt="${play.name} ${play.diagramLabel || 'play'}" loading="lazy" onerror="this.src='assets/play-diagrams/formation-fallback.svg'">
      <figcaption>${play.diagramLabel || 'Formation schematic'} - ${play.diagramVerification === 'verified' ? 'Verified' : play.diagramVerification === 'partial' ? 'Concept matched' : 'Formation only'}</figcaption>
    </figure>
    <div class="fit-grid">
      <div class="metric"><span>Situation fit</span><strong>${signed(play.situationModifier)}</strong></div>
      <div class="metric"><span>Personnel fit</span><strong>${signed(play.personnelFit)}</strong></div>
      <div class="metric"><span>Matchup fit</span><strong>${signed(play.matchupModifier)}</strong></div>
      <div class="metric"><span>Risk penalty</span><strong>${signed(play.riskPenalty)}</strong></div>
    </div>
    <div class="metrics-grid">
      <div class="metric"><span>Success rate</span><strong>${metrics.successRate}</strong></div>
      <div class="metric"><span>Yards per play</span><strong>${metrics.yardsPerPlay}</strong></div>
      <div class="metric"><span>Explosive rate</span><strong>${metrics.explosiveRate}</strong></div>
      <div class="metric"><span>Recent use</span><strong>${metrics.recentUse}</strong></div>
      <div class="metric"><span>Verified primary player</span><strong>${play.primaryPlayerName}</strong></div>
      <div class="metric"><span>Verified secondary player</span><strong>${play.secondaryPlayerName}</strong></div>
    </div>
    <p class="why"><strong>Why this play:</strong> ${explanationText(play)}</p>
    <details class="breakout">
      <summary>Full score breakdown</summary>
      ${scoreBreakdown(play)}
    </details>
    <div class="card-actions">
      <button type="button" onclick="switchTab('gameplan')">Opening Script</button>
      <button type="button" onclick="switchTab('more')">Scouting Report</button>
    </div>
  </article>`;
}

function renderRecommendations(picks) {
  if (!$("recommendation")) return;
  if (!picks.length) {
    $("recommendation").innerHTML = `<div class="card-label">Best Call</div><h2>No eligible call</h2><p class="small">No eligible play for the current situation.</p>`;
    renderTopAlternatives([]);
    return;
  }
  $("recommendation").innerHTML = bestCallCard(picks[0], 1, "Best Call");
  renderTopAlternatives(picks.slice(1));
}

function renderTopAlternatives(picks) {
  if (!$("top3Inline")) return;
  $("top3Inline").innerHTML = `<div class="section-heading"><p>Top 3 Alternatives</p><strong>Rotated families</strong></div>` +
    (picks.length ? `<div class="alt-grid">${picks.map((play, i) => `<article class="alt-card">
      <div class="best-head">
        <div class="rank-badge">${i + 2}</div>
        <div><h3>${play.name}</h3><div class="small">${play.formation} / ${play.conceptFamily}</div></div>
        <div class="score">${play.score}</div>
      </div>
      <figure class="play-diagram mini-diagram">
        <img src="${play.diagramPath || 'assets/play-diagrams/formation-fallback.svg'}" alt="${play.name}" loading="lazy" onerror="this.src='assets/play-diagrams/formation-fallback.svg'">
      </figure>
      <div class="small">${explanationText(play)}</div>
    </article>`).join("")}</div>` : `<p class="small">Use Show Top 3 Plays to populate alternatives.</p>`);
}

function renderGameplanPanels() {
  const weekly = weeklyGameplanData();
  if ($("quickSummary")) {
    $("quickSummary").innerHTML = `<div class="section-heading"><p>Quick Tactical Summary</p><strong>${displayValue(weekly.opponent || WEEKLY_PLAN.opponent.name)}</strong></div>` +
      `<div class="subgrid">${(weekly.quick_tactical_summary || []).map(item => `<div class="mini-card">${displayValue(item)}</div>`).join("") || `<p class="small">Pending weekly detail.</p>`}</div>`;
  }
  if ($("gameDayUsage")) {
    const usage = weekly.game_day_usage || {};
    $("gameDayUsage").innerHTML = `<div class="section-heading"><p>Game-Day Usage</p><strong>Live constraints</strong></div>
      <div class="overview-grid">
        <div class="metric"><span>Target run rate</span><strong>${displayValue(usage.target_run_rate)}</strong></div>
        <div class="metric"><span>Target pass rate</span><strong>${displayValue(usage.target_pass_rate)}</strong></div>
      </div>
      ${(usage.notes || []).map(note => `<p class="small">${displayValue(note)}</p>`).join("")}`;
  }
  if ($("gameDayAlerts")) {
    const alerts = weekly.alerts || [];
    $("gameDayAlerts").innerHTML = alerts.length ? `<div class="section-heading"><p>Game-Day Alerts</p><strong>Optional</strong></div>${alerts.map(alert => `<div class="notice warn">${displayValue(alert)}</div>`).join("")}` : "";
  }
}

function previewBest() {
  state.ranked = buildRankings();
  renderRecommendations(diverseTop(state.ranked, 4));
  renderGameplanPanels();
  renderRanks();
}

function showBest(count = 1) {
  rank();
  const picks = count === 1 ? diverseTop(state.ranked, 4) : diverseTop(state.ranked, 4);
  renderRecommendations(picks);
  markCalled(picks.slice(0, 1));
  rank();
}

function readLogControls(playId) {
  return {
    yards: Number($(`yards-${playId}`)?.value || 0),
    sack: Boolean($(`sack-${playId}`)?.checked),
    turnover: Boolean($(`turnover-${playId}`)?.checked),
    explosive: Boolean($(`explosive-${playId}`)?.checked),
    thirdDownConversion: Boolean($(`third-${playId}`)?.checked),
    redZoneTouchdown: Boolean($(`redzone-${playId}`)?.checked)
  };
}

function record(playId, result) {
  if (!playMap().has(playId)) { setStatus(`Rejected unknown play ID: ${playId}`); return; }
  const rows = loadHistory();
  rows.push({ timestamp: new Date().toISOString(), opponent: WEEKLY_PLAN.opponent.name, playId, result, ...readLogControls(playId) });
  saveHistory(rows);
  setStatus(`Saved ${result} for ${playMap().get(playId).name}`);
  rank();
}

function renderStatic() {
  renderGamedayHeader();
  if ($("scriptList")) $("scriptList").innerHTML = WEEKLY_PLAN.openingScript.map((id, i) => {
    const play = playMap().get(id);
    return `<div class="call"><div class="rank">${i + 1}</div><div><h3>${play ? play.name : id}</h3><div class="small">${play ? play.formation : "INVALID PLAY ID"}</div></div></div>`;
  }).join("");
  const scoutingHtml = WEEKLY_PLAN.traits.map(t => `<div class="trait"><h3>${t.title}</h3><div class="small">${t.evidence}</div><p>${t.response}</p></div>`).join("") + `<h3>Warnings</h3>` + WEEKLY_PLAN.warnings.map(x => `<p>- ${x}</p>`).join("");
  if ($("gameplanScoutList")) $("gameplanScoutList").innerHTML = scoutingHtml;
  renderUsage();
  renderPersonnelMatchups();
  renderGameplanPanels();
  renderPackagePanel();
  renderRecruiting();
}

function renderGamedayHeader() {
  const gameday = WEEKLY_PLAN.gameday || {};
  const opponent = WEEKLY_PLAN.opponent || {};
  const profile = typeof TEAM_PROFILE !== "undefined" ? TEAM_PROFILE : {};
  setText("programLabel", "Rutgers Football");
  setText("appTitle", gameday.title || profile.app_name || "Gameday Gameplan");
  const week = gameday.currentWeek || (profile.week ? `Week ${profile.week}` : opponent.week);
  const opponentName = profile.opponent || opponent.name;
  setText("weekOpponent", `${displayValue(week)} vs ${displayValue(opponentName)}`);
  setText("seasonRecord", gameday.seasonRecord || profile.record || "");
  setText("rutgersRank", gameday.rutgersRank || profile.rutgers_rank || "");
  setText("offenseRank", gameday.offenseRank || profile.offense_rank || "");
  setText("defenseRank", gameday.defenseRank || profile.defense_rank || "");
  setText("momentumStatus", gameday.momentumStatus || profile.momentum_status || "");
}

function renderUsage() {
  const groups = {
    "Quarterbacks": ["QB1", "QB2"],
    "Running Backs": ["HB1", "HB2", "FB"],
    "Wide Receivers": ["WR1", "WR2", "WR3", "WR4"],
    "Tight Ends": ["TE1", "TE2"],
    "Specialty / Gadget": ["GADGET"]
  };
  const players = weeklyPlayers();
  if (!$("usageList")) return;
  $("usageList").innerHTML = Object.entries(groups).map(([title, ids]) => `<details class="usageGroup" open>
    <summary>${title}</summary>
    ${ids.map(id => playerCard(players[id])).join("")}
  </details>`).join("");
}

function playerCard(player) {
  if (!player) return "";
  return `<div class="usage">
    <h3>${player.name}</h3>
    <div class="small">${player.position} - ${player.depthRole} - ${player.priorityLabel}</div>
    <p><strong>Overall:</strong> ${displayValue(player.overall)}</p>
    <p><strong>Key attributes:</strong> ${displayValue(player.attributes)}</p>
    <p><strong>Season stats:</strong> ${displayValue(player.seasonStats)}</p>
    <p><strong>Last-game stats:</strong> ${displayValue(player.lastGameStats)}</p>
    <p><strong>Rolling efficiency:</strong> ${displayValue(player.rollingStats)}</p>
    <p><strong>Weekly role:</strong> ${displayValue(player.weeklyRole)}</p>
    <p><strong>Workload target:</strong> ${displayValue(player.workloadTarget)}</p>
    <p><strong>Best concepts:</strong> ${displayValue(player.bestConcepts)}</p>
    <p><strong>Best formations:</strong> ${displayValue(player.bestFormations)}</p>
    <p><strong>Matchup advantage:</strong> ${displayValue(player.matchupAdvantages)}</p>
    <p><strong>Risk / limitation:</strong> ${displayValue(player.risks)}</p>
    <p><strong>In-game trigger:</strong> ${displayValue(player.usageTriggers)}</p>
  </div>`;
}

function readStoredJson(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

function teamNeedsData() {
  return (typeof RECRUITING_WEEKLY !== "undefined" && RECRUITING_WEEKLY.team_needs) || (typeof TEAM_NEEDS_DATA !== "undefined" ? TEAM_NEEDS_DATA : { positions: [] });
}

function recruitsData() {
  return (typeof RECRUITING_WEEKLY !== "undefined" && RECRUITING_WEEKLY.recruits) || (typeof RECRUITS_DATA !== "undefined" ? RECRUITS_DATA : { prospects: [] });
}

function rosterData() {
  return sharedRosterBase();
}

function recruitingBoardData() {
  return (typeof RECRUITING_WEEKLY !== "undefined" && RECRUITING_WEEKLY.recruiting_board) || (typeof RECRUITING_BOARD !== "undefined" ? RECRUITING_BOARD : { entries: [] });
}

function recruitingSettings() {
  return (typeof RECRUITING_WEEKLY !== "undefined" && RECRUITING_WEEKLY.recruiting_settings) || (typeof RECRUITING_SETTINGS !== "undefined" ? RECRUITING_SETTINGS : { priority_weights: {}, missing_metric_behavior: "neutral" });
}

function recruitingPerformance() {
  return (typeof RECRUITING_WEEKLY !== "undefined" && RECRUITING_WEEKLY.recruiting_performance) || (typeof RECRUITING_PERFORMANCE !== "undefined" ? RECRUITING_PERFORMANCE : { metrics: {}, missing_metric_behavior: "neutral" });
}

function normalizePosition(position) {
  if (!position) return "Unknown";
  if (position === "LT" || position === "RT") return "T";
  return position;
}

function clampUnit(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 0.5;
  return Math.max(0, Math.min(1, Number(value)));
}

function rosterSignals(position, roster = rosterData()) {
  const players = (roster.players || []).filter(player => normalizePosition(player.position) === position);
  const seniors = players.filter(player => String(player.class_year || player.year || "").includes("SR")).length;
  const verified = players.filter(player => player.verification_status).length;
  const avgOverallValues = players.map(player => player.overall_displayed).filter(value => value !== null && value !== undefined);
  const avgOverall = avgOverallValues.length ? avgOverallValues.reduce((sum, value) => sum + Number(value), 0) / avgOverallValues.length : null;
  return {
    knownPlayers: players.length,
    verifiedPlayers: verified,
    futureDepthRisk: players.length ? Math.min(1, seniors / Math.max(players.length, 1)) : 0.5,
    talentUpgradePotential: avgOverall === null ? 0.5 : Math.max(0, Math.min(1, (82 - avgOverall) / 20)),
    diagnostics: players.length ? `${players.length} verified roster entr${players.length === 1 ? "y" : "ies"} available.` : "No verified roster entries for this position; neutral roster-feed components used."
  };
}

function prospectSignals(position, recruits = recruitsData()) {
  const prospects = (recruits.prospects || []).filter(prospect => normalizePosition(prospect.position) === position);
  const knownInterest = prospects.map(prospect => prospect.interest_level).filter(value => value !== null && value !== undefined);
  const knownPipeline = prospects.map(prospect => prospect.pipeline).filter(value => value !== null && value !== undefined);
  const knownStars = prospects.map(prospect => prospect.stars).filter(value => value !== null && value !== undefined);
  return {
    boardCount: prospects.length,
    signingProbability: knownInterest.length ? 0.65 : 0.5,
    pipelineStrength: knownPipeline.length ? 0.65 : 0.5,
    interestLevel: knownInterest.length ? 0.65 : 0.5,
    talentUpgradePotential: knownStars.length ? Math.max(...knownStars) / 5 : 0.5
  };
}

function performanceNeed(position, performance = recruitingPerformance()) {
  const metrics = performance.metrics || {};
  const related = {
    QB: ["explosive_passing"],
    HB: ["rushing_efficiency", "red_zone_efficiency"],
    WR: ["explosive_passing", "red_zone_efficiency"],
    TE: ["red_zone_efficiency"],
    T: ["pass_protection", "rushing_efficiency"],
    G: ["pass_protection", "rushing_efficiency"],
    C: ["pass_protection", "rushing_efficiency"],
    EDGE: ["pressure_rate"],
    DT: ["pressure_rate"],
    OLB: ["pressure_rate", "missed_tackles"],
    MIKE: ["missed_tackles"],
    CB: ["coverage_breakdowns"],
    FS: ["coverage_breakdowns", "missed_tackles"],
    SS: ["coverage_breakdowns", "missed_tackles"],
    K: [],
    P: []
  }[position] || [];
  const values = related.map(key => metrics[key]).filter(value => value !== null && value !== undefined);
  if (!values.length) return { value: 0.5, available: false, note: "Performance metrics unavailable; neutral weighting applied." };
  const avg = values.reduce((sum, value) => sum + Number(value), 0) / values.length;
  return { value: clampUnit(avg), available: true, note: "Performance metrics available." };
}

function priorityScore(positionNeed, data = {}) {
  const weights = recruitingSettings().priority_weights || {};
  const position = positionNeed.position;
  const recommended = Number(positionNeed.recommended_targets || 0);
  const current = Number(positionNeed.current_targets || 0);
  const deficit = Math.max(0, recommended - current);
  const roster = rosterSignals(position, data.roster);
  const prospects = prospectSignals(position, data.recruits);
  const performance = performanceNeed(position, data.performance);
  const overcovered = (teamNeedsData().overcovered_positions || []).includes(position);
  const boardCoverage = recommended > 0 ? Math.min(1, current / recommended) : current > 0 ? 1 : 0;
  const components = {
    rosterNeed: recommended > 0 ? deficit / recommended : 0,
    currentPerformanceNeed: performance.value,
    futureDepthRisk: roster.futureDepthRisk,
    schemeFit: 0.5,
    talentUpgradePotential: Math.max(roster.talentUpgradePotential, prospects.talentUpgradePotential),
    signingProbability: prospects.signingProbability,
    pipelineStrength: prospects.pipelineStrength,
    interestLevel: prospects.interestLevel,
    existingBoardCoverage: Math.max(boardCoverage, overcovered ? 1 : 0),
    recruitingCost: 0,
    competitionDifficulty: 0
  };
  const score =
    components.rosterNeed * (weights.roster_need || 0) +
    components.currentPerformanceNeed * (weights.current_performance_need || 0) +
    components.futureDepthRisk * (weights.future_depth_risk || 0) +
    components.schemeFit * (weights.scheme_fit || 0) +
    components.talentUpgradePotential * (weights.talent_upgrade_potential || 0) +
    components.signingProbability * (weights.signing_probability || 0) +
    components.pipelineStrength * (weights.pipeline_strength || 0) +
    components.interestLevel * (weights.interest_level || 0) +
    components.existingBoardCoverage * (weights.existing_board_coverage_penalty || 0) +
    components.recruitingCost * (weights.recruiting_cost_penalty || 0) +
    components.competitionDifficulty * (weights.competition_difficulty_penalty || 0);
  return {
    position,
    side: positionNeed.side,
    currentTargets: current,
    recommendedTargets: recommended,
    targetDeficit: deficit,
    coverageStatus: deficit > 0 ? "Under-covered" : current > recommended ? "Over-covered" : "Covered",
    overcovered,
    score: Math.round(score * 10) / 10,
    components,
    performanceNote: performance.note,
    rosterNote: roster.diagnostics
  };
}

function priorityBoard() {
  const initialOrder = teamNeedsData().initial_priority_order || [];
  return (teamNeedsData().positions || [])
    .map(need => priorityScore(need))
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff) return scoreDiff;
      const aIndex = initialOrder.includes(a.position) ? initialOrder.indexOf(a.position) : 999;
      const bIndex = initialOrder.includes(b.position) ? initialOrder.indexOf(b.position) : 999;
      return aIndex - bIndex || a.position.localeCompare(b.position);
    });
}

function recommendedActionForRecruit(prospect) {
  const position = normalizePosition(prospect.position);
  const priority = priorityBoard().find(row => row.position === position);
  if (!prospect.position) return "Review position before assigning hours";
  if (priority && priority.targetDeficit > 0 && prospect.scouting_percent === null) return "Scout";
  if (priority && priority.targetDeficit > 0 && prospect.scholarship_offered === null) return "Evaluate offer when verified";
  if (priority && priority.overcovered) return "Maintain only if upgrade is verified";
  return priority && priority.targetDeficit > 0 ? "Maintain priority target" : "Maintain / review";
}

function renderRoster() {
  if (!$("rosterList")) return;
  const roster = rosterData();
  $("rosterList").innerHTML = `<h3>Shared Roster Foundation</h3><div class="subgrid">
    ${(roster.players || []).map(player => `<div class="mini-card">
      <h3>${unknownValue(player.display_name)}</h3>
      <div class="small">${unknownValue(player.position)} - ${unknownValue(player.class_year)} ${unknownValue(player.redshirt_status) !== "Unknown" ? `(${unknownValue(player.redshirt_status)})` : ""}</div>
      <p><strong>OVR:</strong> ${unknownValue(player.overall_displayed)} ${player.overall_sidebar_boosted !== null && player.overall_sidebar_boosted !== undefined ? `(boosted ${player.overall_sidebar_boosted})` : ""}</p>
      <p><strong>Size:</strong> ${unknownValue(player.height)} / ${unknownValue(player.weight_lbs)}</p>
      <p><strong>Archetype:</strong> ${unknownValue(player.archetype)}</p>
    </div>`).join("") || `<p class="small">Unknown</p>`}
  </div>`;
}

function listPanel(title, rows, renderer) {
  return `<h3>${title}</h3>${rows && rows.length ? rows.map(renderer).join("") : `<p class="small">Pending weekly detail.</p>`}`;
}

function renderPersonnelMatchups() {
  const weekly = weeklyGameplanData();
  if ($("lineAnalysis")) {
    $("lineAnalysis").innerHTML = listPanel("Offensive Line / Protection", weekly.protection || [], row => `<div class="mini-card"><strong>${displayValue(row.item)}</strong><p>${displayValue(row.recommendation)}</p><div class="small">${displayValue(row.evidence)}</div></div>`);
  }
  if ($("runDirectionList")) {
    $("runDirectionList").innerHTML = listPanel("Run Direction", weekly.run_direction || [], row => `<div class="mini-card"><strong>${displayValue(row.direction)}</strong><p>${displayValue(row.recommendation)}</p><div class="small">${displayValue(row.evidence)}</div></div>`);
  }
  if ($("protectionList")) {
    $("protectionList").innerHTML = listPanel("Protection Calls", weekly.protection || [], row => `<div class="mini-card"><strong>${displayValue(row.item)}</strong><p>${displayValue(row.recommendation)}</p></div>`);
  }
  if ($("opponentDefenseList")) {
    $("opponentDefenseList").innerHTML = listPanel("Opponent Defense", weekly.opponent_defense || [], row => `<div class="mini-card"><strong>${displayValue(row.unit)}</strong><p>${displayValue(row.summary)}</p></div>`);
  }
  if ($("matchupMatrix")) {
    $("matchupMatrix").innerHTML = listPanel("Matchup Matrix", weekly.matchup_matrix || [], row => `<div class="mini-card"><strong>${displayValue(row.rutgers)} vs ${displayValue(row.opponent)}</strong><p>${displayValue(row.fit)}</p></div>`);
  }
}

function renderHistory() {
  if (!$("historyList")) return;
  const rows = loadHistory().slice(-8).reverse();
  $("historyList").innerHTML = rows.length ? rows.map(row => {
    const play = playMap().get(row.playId);
    return `<div class="history-row"><strong>${play ? play.name : row.playId}</strong><span>${row.result} / ${displayValue(row.yards)} yards</span></div>`;
  }).join("") : "No logged calls yet.";
}

function renderRecruiting() {
  renderRoster();
  renderHistory();
  if (!$("recruitingOverview")) return;
  const needs = teamNeedsData();
  const recruits = recruitsData();
  const roster = rosterData();
  const priorities = priorityBoard();
  const critical = priorities.filter(row => row.targetDeficit > 0).slice(0, 5).map(row => row.position);
  const over = priorities.filter(row => row.overcovered).map(row => row.position);
  $("recruitingOverview").innerHTML = `<div class="overview-grid">
    <div class="metric"><span>Class rank</span><strong>Unknown</strong></div>
    <div class="metric"><span>Commits</span><strong>Unknown</strong></div>
    <div class="metric"><span>Scholarships remaining</span><strong>Unknown</strong></div>
    <div class="metric"><span>Board size</span><strong>${(recruits.prospects || []).length}</strong></div>
    <div class="metric"><span>Weekly hours</span><strong>Unknown</strong></div>
    <div class="metric"><span>Roster records</span><strong>${(roster.players || []).length}</strong></div>
  </div>
  <div class="notice good">Top alerts: prioritize ${critical.join(", ") || "Unknown"}.</div>
  <div class="notice warn">Over-covered positions: ${over.join(", ") || "None"}.</div>`;
  $("teamNeedsList").innerHTML = `<h3>Team Needs</h3>${priorities.map(row => `<div class="need-row">
    <div><strong>${row.position}</strong><span>${labelize(row.side)} / ${row.coverageStatus}</span></div>
    <div><span>Targets</span><strong>${row.currentTargets} / ${row.recommendedTargets}</strong></div>
    <div><span>Deficit</span><strong>${row.targetDeficit}</strong></div>
    <div><span>Priority</span><strong>${row.score}</strong></div>
    <p>${row.coverageStatus}. Shared roster and performance data are applied when verified values exist.</p>
  </div>`).join("")}`;
  $("priorityList").innerHTML = `<h3>Position Priority Engine</h3>${priorities.slice(0, 8).map((row, index) => `<div class="priority-row">
    <span>${index + 1}</span><strong>${row.position}</strong><em>${row.score}</em>
  </div>`).join("")}`;
  renderRecruitingFilters();
  renderRecruitList();
}

function currentRecruitFilters() {
  return {
    position: $("filterPosition") ? $("filterPosition").value : "all",
    verified: $("filterVerified") ? $("filterVerified").checked : false,
    needsReview: $("filterNeedsReview") ? $("filterNeedsReview").checked : false,
    priority: $("filterPriority") ? $("filterPriority").checked : false
  };
}

function renderRecruitingFilters() {
  if (!$("recruitingFilters")) return;
  const positions = [...new Set((recruitsData().prospects || []).map(prospect => normalizePosition(prospect.position)))].sort();
  $("recruitingFilters").innerHTML = `<label>Position
    <select id="filterPosition"><option value="all">All</option>${positions.map(position => `<option value="${position}">${position}</option>`).join("")}</select>
  </label>
  <label><input id="filterVerified" type="checkbox"> Verified</label>
  <label><input id="filterNeedsReview" type="checkbox"> Needs Review</label>
  <label><input id="filterPriority" type="checkbox"> Priority Position</label>`;
  ["filterPosition", "filterVerified", "filterNeedsReview", "filterPriority"].forEach(id => $(id).addEventListener("change", renderRecruitList));
}

function filteredRecruits() {
  const filters = currentRecruitFilters();
  const priorityPositions = new Set(priorityBoard().filter(row => row.targetDeficit > 0).slice(0, 8).map(row => row.position));
  return (recruitsData().prospects || []).filter(prospect => {
    const position = normalizePosition(prospect.position);
    if (filters.position !== "all" && position !== filters.position) return false;
    if (filters.verified && !(prospect.verification_status || "").includes("visible")) return false;
    if (filters.needsReview && !(prospect.verification_status || "").includes("need")) return false;
    if (filters.priority && !priorityPositions.has(position)) return false;
    return true;
  });
}

function renderRecruitList() {
  if (!$("recruitList")) return;
  const rows = filteredRecruits();
  $("recruitList").innerHTML = `<h3>Recruiting Board</h3>${rows.map(prospect => `<button class="recruit-row" type="button" onclick="renderRecruitDetail('${prospect.id}')">
    <strong>${unknownValue(prospect.display_name)}</strong>
    <span>${unknownValue(prospect.position)} / ${unknownValue(prospect.stars)} stars</span>
    <em>${recommendedActionForRecruit(prospect)}</em>
  </button>`).join("") || `<p class="small">No recruits match the current filters.</p>`}`;
  if (rows[0]) renderRecruitDetail(rows[0].id);
}

function renderRecruitDetail(id) {
  if (!$("recruitDetail")) return;
  const prospect = (recruitsData().prospects || []).find(row => row.id === id);
  if (!prospect) {
    $("recruitDetail").innerHTML = "";
    return;
  }
  const position = normalizePosition(prospect.position);
  const priority = priorityBoard().find(row => row.position === position);
  $("recruitDetail").innerHTML = `<div class="detail-card">
    <div class="section-heading"><p>Recruit Detail</p><strong>${unknownValue(prospect.display_name)}</strong></div>
    <div class="overview-grid">
      <div class="metric"><span>Position</span><strong>${unknownValue(prospect.position)}</strong></div>
      <div class="metric"><span>Stars</span><strong>${unknownValue(prospect.stars)}</strong></div>
      <div class="metric"><span>National rank</span><strong>${unknownValue(prospect.national_rank)}</strong></div>
      <div class="metric"><span>Position rank</span><strong>${unknownValue(prospect.position_rank)}</strong></div>
      <div class="metric"><span>Height</span><strong>${unknownValue(prospect.height)}</strong></div>
      <div class="metric"><span>Weight</span><strong>${unknownValue(prospect.weight)}</strong></div>
      <div class="metric"><span>Pipeline</span><strong>${unknownValue(prospect.pipeline)}</strong></div>
      <div class="metric"><span>Interest</span><strong>${unknownValue(prospect.interest_level)}</strong></div>
    </div>
    <p><strong>Scholarship:</strong> ${unknownValue(prospect.scholarship_offered)}</p>
    <p><strong>Scouting:</strong> ${unknownValue(prospect.scouting_percent)}</p>
    <p><strong>Gem / bust:</strong> ${unknownValue(prospect.gem_bust)}</p>
    <p><strong>Visit:</strong> ${unknownValue(prospect.visit_status)}</p>
    <p><strong>Top schools:</strong> ${unknownValue(prospect.top_schools)}</p>
    <p><strong>Rutgers rank:</strong> ${unknownValue(prospect.rutgers_school_rank)}</p>
    <p><strong>Dealbreaker:</strong> ${unknownValue(prospect.dealbreaker)}</p>
    <p><strong>Scheme fit:</strong> ${priority ? "Neutral until verified attributes are available" : "Unknown"}</p>
    <p><strong>Projected role:</strong> ${priority && priority.targetDeficit > 0 ? "Priority depth target" : "Review target"}</p>
    <p><strong>Recommended weekly action:</strong> ${recommendedActionForRecruit(prospect)}</p>
  </div>`;
  renderActionPlan();
}

function renderActionPlan() {
  if (!$("actionPlanList")) return;
  const actions = filteredRecruits().slice(0, 8).map(prospect => {
    const position = normalizePosition(prospect.position);
    const priority = priorityBoard().find(row => row.position === position);
    const reason = priority ? `${position} priority score ${priority.score}; ${priority.coverageStatus}.` : "Position unreadable; review before assigning resources.";
    return `<div class="action-row-card"><strong>${unknownValue(prospect.display_name)}</strong><span>${recommendedActionForRecruit(prospect)}</span><p>${reason}</p></div>`;
  });
  $("actionPlanList").innerHTML = `<h3>Weekly Action Plan</h3>${actions.join("") || `<p class="small">Unknown</p>`}`;
}

function exportJsonFile(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importEnginePackage(file, kind) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (kind === "gameplan") {
        validateGameplanWeekly(parsed);
        window.GAMEPLAN_WEEKLY = parsed;
        localStorage.setItem(GAMEPLAN_WEEKLY_KEY, JSON.stringify(parsed));
      } else {
        validateRecruitingWeekly(parsed);
        window.RECRUITING_WEEKLY = parsed;
        localStorage.setItem(RECRUITING_WEEKLY_KEY, JSON.stringify(parsed));
      }
      renderStatic();
      previewBest();
      setStatus(`Imported ${kind} package: ${parsed.package_name}`);
    } catch (err) {
      setStatus(`Import rejected: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

function renderPackagePanel() {
  if (!$("enginePackagePanel")) return;
  const gameplan = weeklyGameplanData();
  const recruiting = typeof RECRUITING_WEEKLY !== "undefined" ? RECRUITING_WEEKLY : {};
  $("enginePackagePanel").innerHTML = `<div class="tool-grid">
    <button id="exportGameplanBtn" type="button">Export Gameplan JSON</button>
    <label class="fileTool">Import Gameplan JSON<input id="importGameplanWeekly" type="file" accept="application/json,.json"></label>
    <button id="exportRecruitingBtn" type="button">Export Recruiting JSON</button>
    <label class="fileTool">Import Recruiting JSON<input id="importRecruitingWeekly" type="file" accept="application/json,.json"></label>
  </div>
  <div class="overview-grid package-status">
    <div class="metric"><span>Current Gameplan package name</span><strong>${displayValue(gameplan.package_name)}</strong></div>
    <div class="metric"><span>Current Recruiting package name</span><strong>${displayValue(recruiting.package_name)}</strong></div>
    <div class="metric"><span>Week</span><strong>${displayValue(gameplan.week || WEEKLY_PLAN.opponent.week)}</strong></div>
    <div class="metric"><span>Opponent</span><strong>${displayValue(gameplan.opponent || WEEKLY_PLAN.opponent.name)}</strong></div>
    <div class="metric"><span>Last updated</span><strong>${displayValue(gameplan.last_updated || WEEKLY_PLAN.gameday.lastUpdated)}</strong></div>
    <div class="metric"><span>Validation status</span><strong>Loaded</strong></div>
    <div class="metric"><span>Import result</span><strong id="importResult">Waiting</strong></div>
  </div>`;
  $("exportGameplanBtn").addEventListener("click", () => exportJsonFile("gameplan_weekly.json", weeklyGameplanData()));
  $("exportRecruitingBtn").addEventListener("click", () => exportJsonFile("recruiting_weekly.json", typeof RECRUITING_WEEKLY !== "undefined" ? RECRUITING_WEEKLY : {}));
  $("importGameplanWeekly").addEventListener("change", event => importEnginePackage(event.target.files[0], "gameplan"));
  $("importRecruitingWeekly").addEventListener("change", event => importEnginePackage(event.target.files[0], "recruiting"));
}

function labelForKey(key) {
  return labelize(String(key || "").replace(/_/g, " "));
}

function formatObjectValue(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 2) return "";
  const entries = Object.entries(value).filter(([key, item]) => !["schema_version","package_type","source_video","source_videos","verification_status"].includes(key) && cleanValue(item));
  if (!entries.length) return "";
  const preferred = ["name","player","position","overall","archetype","threat_type","matchup","lane","recommendation","adjustment","summary","description"];
  const ordered = entries.sort(([a], [b]) => {
    const ai = preferred.indexOf(a);
    const bi = preferred.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return ordered.slice(0, depth ? 6 : 8).map(([key, item]) => `${labelForKey(key)}: ${cleanValue(item, depth + 1)}`).join("; ");
}

function cleanValue(value, depth = 0) {
  if (value === null || value === undefined || value === "" || value === "Unknown" || value === "Not available") return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(item => cleanValue(item, depth + 1)).filter(Boolean).join(", ");
  if (typeof value === "object") return formatObjectValue(value, depth);
  const text = String(value).trim();
  if (!text || text === "undefined" || text === "null" || text === "[object Object]") return "";
  return text;
}

function formatLimited(value, fallback = "Limited data") {
  return cleanValue(value) || fallback;
}

function maybeRow(label, value, fallback = "") {
  const cleaned = cleanValue(value);
  if (cleaned) return `<div class="data-row"><span>${label}</span><strong>${cleaned}</strong></div>`;
  return fallback ? `<div class="data-row limited"><span>${label}</span><strong>${fallback}</strong></div>` : "";
}

function chipList(items, className = "value-chips") {
  const rows = Array.isArray(items) ? items.map(item => cleanValue(item)).filter(Boolean) : cleanValue(items).split(",").map(item => item.trim()).filter(Boolean);
  return rows.length ? `<div class="${className}">${rows.map(item => `<span>${item}</span>`).join("")}</div>` : "";
}

function maybeList(items) {
  const rows = (items || []).map(item => cleanValue(item)).filter(Boolean);
  return rows.length ? `<ul class="tight-list">${rows.map(item => `<li>${item}</li>`).join("")}</ul>` : "";
}

function firstClean(items) {
  return (items || []).map(cleanValue).find(Boolean) || "";
}

function activeOpponentName() {
  const opp = loadOpponentProfile();
  return cleanValue(opp.team || (loadGameplanWeekly() || {}).opponent || WEEKLY_PLAN.opponent.name);
}

const ROSTER_POSITION_GROUPS = ["QB","HB","WR","TE","LT","LG","C","RG","RT","EDGE","DT","LB","CB","FS","SS","K","P"];

function rosterGroupFor(position) {
  const pos = normalizePosition(position);
  if (["LEDG","REDG","EDGE"].includes(pos)) return "EDGE";
  if (["MIKE","WILL","SAM","LB"].includes(pos)) return "LB";
  if (["HB","RB","FB"].includes(pos)) return "HB";
  return pos;
}

function groupRosterPlayers(group) {
  return (loadRutgersRoster().players || []).filter(player => rosterGroupFor(player.position) === group)
    .sort((a, b) => Number(b.overall || 0) - Number(a.overall || 0));
}

function positionStatus(players) {
  if (!players.length) return "No verified depth";
  if (players.length === 1) return "Depth warning";
  const starter = players[0];
  return cleanValue((starter.analysis || {}).development_outlook) || cleanValue((starter.analysis || {}).role) || "Available";
}

function showRosterGroup(group) {
  const panel = $("personnelPanel");
  if (panel) panel.innerHTML = renderRosterCards(group);
}

function topAttributes(entity, max = 3) {
  const display = ((entity.analysis || entity.ui_analysis || {}).display_stats || {}).top_attributes;
  if (Array.isArray(display) && display.length) return display.slice(0, max).map(item => `${item.label} ${item.value}`);
  if (entity.attributes && typeof entity.attributes === "object") {
    return Object.entries(entity.attributes).filter(([, value]) => cleanValue(value)).slice(0, max).map(([key, value]) => `${labelize(key)} ${value}`);
  }
  const keys = ["overall","speed","acceleration","agility","change_of_direction","strength","awareness","play_recognition","power_moves","finesse_moves"];
  return keys.filter(key => cleanValue(entity[key]) && key !== "overall").slice(0, max).map(key => `${labelize(key)} ${entity[key]}`);
}

function findRutgersMatchupPlayer(row) {
  if (row.rutgers_player) return row.rutgers_player;
  const unit = cleanValue(row.rutgers_unit);
  const direct = ["LT","LG","C","RG","RT","QB","TE","HB","WR"].find(pos => new RegExp(`(^|[^A-Z])${pos}([^A-Z]|$)`, "i").test(unit));
  let candidates = [];
  if (direct) candidates = groupRosterPlayers(direct);
  else if (/interior offensive line/i.test(unit)) candidates = ["C","LG","RG"].flatMap(groupRosterPlayers);
  else if (/slot|receiver/i.test(unit)) candidates = groupRosterPlayers("WR");
  return candidates.sort((a, b) => Number(b.overall || 0) - Number(a.overall || 0))[0] || null;
}

function findOpponentMatchupPlayer(row) {
  if (row.opponent_player && typeof row.opponent_player === "object") return row.opponent_player;
  const target = cleanValue(row.opponent_player).toLowerCase();
  return (loadOpponentPlayers() || []).find(player => cleanValue(player.name).toLowerCase() === target) || null;
}

function stateFromLocation(value) {
  const text = cleanValue(value);
  const match = text.match(/,\s*([A-Z]{2})$/);
  return match ? match[1] : "";
}

function starRating(value) {
  const stars = Number(value);
  if (!Number.isFinite(stars) || stars < 1) return "";
  return `<span class="stars" aria-label="${stars}-star prospect">${"&#9733;".repeat(Math.min(5, Math.max(1, stars)))}</span>`;
}

const FAVORITE_PLAYS_KEY = "rutgers_call_sheet_favorite_plays";

function favoritePlayIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITE_PLAYS_KEY) || "[]"));
  } catch {
    localStorage.removeItem(FAVORITE_PLAYS_KEY);
    return new Set();
  }
}

function toggleFavoritePlay(playId) {
  const favorites = favoritePlayIds();
  if (favorites.has(playId)) favorites.delete(playId);
  else favorites.add(playId);
  localStorage.setItem(FAVORITE_PLAYS_KEY, JSON.stringify([...favorites]));
  renderRanks();
}

function activeWeekLabel() {
  const raw = cleanValue(loadGameplanWeekly().week || WEEKLY_PLAN.opponent.week);
  if (!raw) return "";
  return /^week\b/i.test(raw) ? raw : `Week ${raw}`;
}

function matchupConfidence() {
  const matchups = loadMatchups() || [];
  if (!matchups.length) return "";
  const highRisk = matchups.filter(row => /high|limited|d/i.test(`${cleanValue(row.risk)} ${cleanValue(row.grade)} ${cleanValue(row.data_limitations)}`)).length;
  if (highRisk >= 2) return "Caution";
  if (matchups.some(row => /Rutgers/i.test(cleanValue(row.status || row.advantage)))) return "Targeted edges";
  return "Verified matchup data loaded";
}

function keyOpponentPlayer(pattern) {
  const players = loadOpponentPlayers() || [];
  const match = players.find(player => pattern.test(`${player.position || ""} ${player.name || ""} ${player.archetype || ""} ${player.description || ""}`));
  return match ? cleanValue(match.name) : "";
}

function highestRiskMatchup() {
  const rows = loadMatchups() || [];
  return rows.find(row => /D|F|high/i.test(`${cleanValue(row.grade)} ${cleanValue(row.risk)}`)) || rows[0] || {};
}

function matchupPriority(row) {
  const explicit = cleanValue(row.priority || row.severity || row.importance || row.risk).toLowerCase();
  if (/critical|high|severe|must/.test(explicit)) return "critical";
  if (/important|medium|watch|alert/.test(explicit)) return "important";
  if (/monitor|low/.test(explicit)) return "monitor";
  const grade = displayGrade(row.grade, row.internal_score);
  const score = Number(row.internal_score);
  const opponentEdge = cleanValue(row.advantage) && !/rutgers|even/i.test(cleanValue(row.advantage));
  if (opponentEdge || /^D|F$/i.test(grade) || (Number.isFinite(score) && score < 70)) return "critical";
  if (/C/i.test(grade) || (Number.isFinite(score) && score < 82)) return "important";
  return "monitor";
}

function matchupPriorityRank(row) {
  return { critical: 3, important: 2, monitor: 1 }[matchupPriority(row)] || 0;
}

function matchupImportance(row) {
  const explicit = Number(row.importance || row.priority_score || row.severity_score);
  if (Number.isFinite(explicit)) return explicit;
  const score = Number(row.internal_score);
  const confidence = Number(row.confidence || 0);
  const opponentEdge = cleanValue(row.advantage) && !/rutgers|even/i.test(cleanValue(row.advantage));
  return (opponentEdge ? 20 : 0) + (Number.isFinite(score) ? Math.max(0, 100 - score) : 0) + confidence / 10;
}

function validMatchupRows() {
  return (loadMatchups() || []).map((row, sourceIndex) => ({ row, sourceIndex, rutgers: findRutgersMatchupPlayer(row), opponent: findOpponentMatchupPlayer(row) }))
    .filter(item => item.rutgers && item.opponent);
}

function orderedMatchupRows() {
  return validMatchupRows().sort((a, b) =>
    matchupPriorityRank(b.row) - matchupPriorityRank(a.row) ||
    Number(b.row.confidence || 0) - Number(a.row.confidence || 0) ||
    matchupImportance(b.row) - matchupImportance(a.row) ||
    a.sourceIndex - b.sourceIndex
  );
}

function loadRutgersRoster() {
  return sharedRosterBase();
}

function loadGameplanWeekly() {
  return weeklyGameplanData();
}

function loadRecruitingClass() {
  return typeof RECRUITING_CLASS !== "undefined" ? RECRUITING_CLASS : { prospects: [] };
}

function loadRecruitingWeekly() {
  return typeof RECRUITING_WEEKLY !== "undefined" ? RECRUITING_WEEKLY : { resources: {}, active_board: [], team_needs: [] };
}

function loadTeamNeeds() {
  return typeof TEAM_NEEDS_ENRICHED !== "undefined" ? TEAM_NEEDS_ENRICHED : teamNeedsData();
}

function loadOpponentProfile() {
  return (loadGameplanWeekly().opponent_profile) || {};
}

function loadOpponentPlayers() {
  return (loadGameplanWeekly().opponent_players) || [];
}

function loadOpponentGroups() {
  return (loadGameplanWeekly().opponent_position_groups) || [];
}

function loadMatchups() {
  if (typeof PLAYER_MATCHUPS !== "undefined" && Array.isArray(PLAYER_MATCHUPS.matchups)) return PLAYER_MATCHUPS.matchups;
  return (loadGameplanWeekly().matchups) || [];
}

function loadRutgersLastGameStats() {
  return typeof RUTGERS_LAST_GAME_STATS !== "undefined" ? RUTGERS_LAST_GAME_STATS : (loadGameplanWeekly().last_game || {});
}

function loadRutgersSeasonStats() {
  return typeof RUTGERS_SEASON_STATS !== "undefined" ? RUTGERS_SEASON_STATS : (loadGameplanWeekly().season_stats || {});
}

function loadOpponentLastGameStats() {
  return typeof OPPONENT_LAST_GAME_STATS !== "undefined" ? OPPONENT_LAST_GAME_STATS : {};
}

function loadOpponentSeasonStats() {
  return typeof OPPONENT_SEASON_STATS !== "undefined" ? OPPONENT_SEASON_STATS : {};
}

function loadRutgersPlayerMedia() {
  return typeof RUTGERS_PLAYER_MEDIA !== "undefined" ? RUTGERS_PLAYER_MEDIA : { players: [] };
}

function loadOpponentPlayerMedia() {
  return typeof OPPONENT_PLAYER_MEDIA !== "undefined" ? OPPONENT_PLAYER_MEDIA : { players: [] };
}

function loadPlayerCardRegistry() {
  return typeof PLAYER_CARD_REGISTRY !== "undefined" ? PLAYER_CARD_REGISTRY : { rutgers_cards: [], opponent_cards: [], counts: {} };
}

function playerId(player) {
  if (!player) return "";
  return cleanValue(player.player_id || player.opponent_player_id || player.id);
}

function mediaForPlayer(player, side = "rutgers") {
  const id = playerId(player);
  if (!id) return null;
  const doc = side === "opponent" ? loadOpponentPlayerMedia() : loadRutgersPlayerMedia();
  return (doc.players || []).find(row => row.player_id === id) || null;
}

function portraitImg(player, side = "rutgers", className = "player-portrait") {
  const media = mediaForPlayer(player, side);
  const name = cleanValue(player && player.name) || "Player";
  return media && cleanValue(media.portrait_path)
    ? `<img class="${className}" src="${media.portrait_path}" alt="${name} fictional portrait" loading="lazy">`
    : `<div class="${className} portrait-fallback" aria-label="${name} portrait unavailable">${cleanValue((name.match(/\b\w/g) || []).slice(0, 2).join("")) || "RU"}</div>`;
}

function flattenStatRows(data) {
  return Object.entries(data || {}).flatMap(([, value]) => Array.isArray(value) ? value : []);
}

function statsForPlayer(player, data) {
  const id = playerId(player);
  const name = cleanValue(player && player.name).toLowerCase();
  return flattenStatRows(data).filter(row => {
    const rowId = cleanValue(row.player_id);
    const rowName = cleanValue(row.name || row.player).toLowerCase();
    return (id && rowId === id) || (name && rowName === name);
  });
}

function compactStats(rows, limit = 5) {
  const entries = (rows || []).flatMap(row => Object.entries(row || {}).filter(([key, value]) => !["player_id","name","player"].includes(key) && cleanValue(value)));
  return entries.slice(0, limit).map(([key, value]) => `${labelize(key)} ${cleanValue(value)}`);
}

function statBlock(title, rows, fallback = "Limited data") {
  const chips = chipList(compactStats(rows, 8), "stat-chip-row");
  return `<section class="mini-stat-block"><h4>${title}</h4>${chips || `<p>${fallback}</p>`}</section>`;
}

function matchupSummaryForPlayer(player, side = "rutgers") {
  const id = playerId(player);
  const rows = (loadMatchups() || []).filter(row => {
    const rutgers = findRutgersMatchupPlayer(row);
    const opponent = findOpponentMatchupPlayer(row);
    return side === "opponent" ? playerId(opponent) === id : playerId(rutgers) === id;
  });
  return rows.map(row => `${cleanValue(row.advantage || row.status)} ${displayGrade(row.grade, row.internal_score)}`.trim()).filter(cleanValue);
}

function usageSummary(player) {
  const analysis = (player && (player.analysis || player.ui_analysis)) || {};
  return firstClean([analysis.best_usage, analysis.recommended_usage, analysis.in_game_trigger, analysis.role, analysis.summary]);
}

function riskSummary(row) {
  if (!row) return "";
  const opponent = findOpponentMatchupPlayer(row) || (row.opponent_player && typeof row.opponent_player === "object" ? row.opponent_player : null);
  const name = cleanValue(opponent && opponent.name) || cleanValue(row.opponent_player);
  const threat = cleanValue((opponent && opponent.archetype) || row.type || row.risk || row.status || row.advantage);
  const lane = cleanValue(row.rutgers_unit || row.matchup || row.lane);
  const rec = firstClean(row.tactical_recommendations || row.recommendations || []);
  return [name, threat, lane, rec].filter(Boolean).join(" — ");
}

function matchupMetricRows(rutgers, opponent, evidence = []) {
  const evidenceByMetric = new Map((evidence || []).filter(item => item && typeof item === "object").map(item => [cleanValue(item.metric || item.label).toLowerCase(), item]));
  const preferred = ["overall","strength","awareness","pass_block","run_block","pass block","run block","speed","acceleration","power_moves","finesse_moves","play_recognition","pursuit","agility","change_of_direction"];
  const keys = [...new Set([
    ...preferred,
    ...Object.keys((rutgers && rutgers.attributes) || {}),
    ...Object.keys((opponent && opponent.attributes) || {}),
    ...evidence.map(item => item && typeof item === "object" ? item.metric : "").filter(Boolean)
  ])].filter(key => {
    if (!key) return false;
    const metric = cleanValue(key);
    const ev = evidenceByMetric.get(metric.toLowerCase());
    return cleanValue((rutgers && rutgers.attributes && rutgers.attributes[key]) ?? (opponent && opponent.attributes && opponent.attributes[key]) ?? (ev && (ev.rutgers ?? ev.opponent)));
  }).slice(0, 10);
  return keys.map(key => {
    const metric = cleanValue(key);
    const ev = evidenceByMetric.get(metric.toLowerCase());
    const rv = (rutgers && rutgers.attributes && rutgers.attributes[key]) ?? (ev && ev.rutgers);
    const ov = (opponent && opponent.attributes && opponent.attributes[key]) ?? (ev && ev.opponent);
    const diff = ev && Number(ev.difference);
    const adv = Number.isFinite(diff) ? (diff > 0 ? "Rutgers" : diff < 0 ? "Opponent" : "Even") : "";
    return { metric, rutgers: rv, opponent: ov, advantage: adv };
  });
}

function comparisonRowHtml(row, className = "default-metric") {
  return `<div class="comparison-row ${className}"><span>${labelize(row.metric)}</span><strong>${formatLimited(row.rutgers)}</strong><em>${formatLimited(row.opponent)}</em><b class="${row.advantage === "Rutgers" ? "good" : row.advantage === "Opponent" ? "bad" : ""}">${row.advantage || "Limited"}</b></div>`;
}

function attributeComparisonRows(rutgers, opponent, evidence = [], limit = 4) {
  const rows = matchupMetricRows(rutgers, opponent, evidence);
  return rows.slice(0, limit).map(row => comparisonRowHtml(row)).join("") || `<div class="comparison-row limited default-metric"><span>Attributes</span><strong>Limited data</strong><em>Limited data</em><b>Limited</b></div>`;
}

function remainingAttributeRows(rutgers, opponent, evidence = [], offset = 4) {
  return matchupMetricRows(rutgers, opponent, evidence).slice(offset).map(row => comparisonRowHtml(row, "detail-metric")).join("");
}

function compactProductionBlock(title, rows) {
  const chips = chipList(compactStats(rows, 4), "stat-chip-row");
  return rows && rows.length ? `<article class="production-card has-data"><h4>${title}</h4>${chips}</article>` : `<article class="production-card limited-production"><h4>${title}</h4><p>Limited data</p></article>`;
}

function tacticalSupport(row, evidence) {
  return firstClean([row.adjustment, row.protection_adjustment, row.run_game_adjustment, row.description, evidence && evidence[0]]);
}

function explicitEdgeDifferential(row) {
  const candidates = [row.verified_edge_differential, row.edge_differential, row.edge_difference, row.differential];
  const value = candidates.find(item => item !== null && item !== undefined && item !== "" && Number.isFinite(Number(item)));
  return value === undefined ? null : Number(value);
}

function matchupEdgeDisplay(row) {
  const advantage = cleanValue(row.advantage || row.status);
  const grade = displayGrade(row.grade, row.internal_score);
  const confidence = cleanValue(row.confidence) ? `${row.confidence}% Confidence` : "";
  const meta = [`Grade ${grade || "Limited"}`, confidence].filter(Boolean).join(" • ");
  const diff = explicitEdgeDifferential(row);
  if (Number.isFinite(diff) && advantage && !/even/i.test(advantage)) {
    return { title: `${advantage.toUpperCase()} ${diff > 0 ? "+" : ""}${diff}`, meta };
  }
  if (advantage && /even/i.test(advantage)) return { title: "EVEN", meta };
  if (advantage) return { title: `${advantage.toUpperCase()} ADVANTAGE`, meta };
  return { title: "LIMITED DATA", meta };
}

function evidenceRows(evidence = []) {
  const opponent = activeOpponentName() || "Opponent";
  const seen = new Set();
  return (evidence || []).map(item => {
    if (!item || typeof item !== "object") return null;
    const metric = cleanValue(item.metric || item.label || item.type);
    const rutgers = cleanValue(item.rutgers);
    const opponentValue = cleanValue(item.opponent);
    const diff = Number(item.difference);
    const result = Number.isFinite(diff) ? (diff > 0 ? "Rutgers edge" : diff < 0 ? `${opponent} edge` : "Even") : cleanValue(item.result || item.interpretation);
    const key = `${metric}|${rutgers}|${opponentValue}|${result}`;
    if (!metric || seen.has(key)) return null;
    seen.add(key);
    return { metric, rutgers, opponent: opponentValue, result };
  }).filter(Boolean);
}

function evidenceRowsHtml(evidence = []) {
  const rows = evidenceRows(evidence);
  return rows.length ? `<div class="evidence-row-list">${rows.map(row => `<div class="evidence-row"><span>${labelize(row.metric)}</span><strong>${row.rutgers ? `Rutgers ${row.rutgers}` : ""}</strong><em>${row.opponent ? `${activeOpponentName()} ${row.opponent}` : ""}</em><b>${row.result || "Limited data"}</b></div>`).join("")}</div>` : `<div class="evidence-row limited"><span>Evidence</span><b>Limited data</b></div>`;
}

function premiumPlayerCard(player, side = "rutgers") {
  const analysis = (player.analysis || player.ui_analysis || {});
  const seasonRows = statsForPlayer(player, side === "opponent" ? loadOpponentSeasonStats() : loadRutgersSeasonStats());
  const lastRows = statsForPlayer(player, side === "opponent" ? loadOpponentLastGameStats() : loadRutgersLastGameStats());
  const classText = cleanValue(player.class_year || player.year || player.class);
  const jersey = cleanValue(player.jersey_number || player.jersey);
  const matchup = matchupSummaryForPlayer(player, side);
  const limited = (!seasonRows.length || !lastRows.length) ? `<p class="limited-note">Limited data where verified production was not provided.</p>` : "";
  return `<details class="person-card premium-player-card compact-person player-detail">
    <summary>
      ${portraitImg(player, side)}
      <span><strong>${cleanValue(player.name)}</strong><em>${cleanValue(player.position)}${classText ? ` | ${classText}` : ""}${jersey ? ` | #${jersey}` : ""}</em></span>
      <b>${cleanValue(player.overall) ? `${player.overall} OVR` : "No OVR"}</b>
    </summary>
    <div class="player-card-grid">
      <div class="portrait-panel">${portraitImg(player, side, "player-portrait large")}</div>
      <div class="card-grid">
        ${maybeRow("Overall", player.overall)}${maybeRow("Position", player.position)}${maybeRow("Class", classText)}${maybeRow("Jersey", jersey)}${maybeRow("Height", player.height)}${maybeRow("Weight", player.weight)}${maybeRow("Development", analysis.development_outlook || analysis.development)}
        ${maybeRow("Attributes", topAttributes(player, 6), "Limited data")}
      </div>
    </div>
    <div class="production-grid">${statBlock("Last Game", lastRows)}${statBlock("Season", seasonRows)}</div>${limited}
    ${maybeRow("Role", analysis.role || analysis.matchup_priority)}${maybeRow("Strengths", analysis.strengths, "Limited data")}${maybeRow("Weaknesses", analysis.limitations || analysis.weaknesses, "Limited data")}${maybeRow("Matchup Summary", matchup, "Limited data")}
    ${maybeRow("Recommended Usage", usageSummary(player))}${maybeRow("Player Notes", analysis.summary || player.description)}
    <details class="nested-detail"><summary>Expandable Detail</summary>${maybeRow("Best formations", analysis.best_formations)}${maybeRow("Matchup advantage", analysis.matchup_advantage)}${maybeRow("Risk", analysis.risk_limitation)}${maybeRow("Trigger", analysis.in_game_trigger)}${maybeRow("Source status", (mediaForPlayer(player, side) || {}).source_status)}</details>
  </details>`;
}

function sharedRosterMatch(player) {
  if (!player || !player.name) return null;
  const wanted = player.name.toLowerCase().replace(/\s+/g, " ").trim();
  return (sharedRosterBase().players || []).find(row => String(row.name || row.display_name || "").toLowerCase().replace(/\s+/g, " ").trim() === wanted) || null;
}

function teamNeedsData() {
  const enriched = loadRecruitingWeekly().team_needs || loadTeamNeeds().positions || [];
  return { positions: enriched, initial_priority_order: enriched.map(row => row.position), overcovered_positions: enriched.filter(row => Number(row.overage || 0) > 0).map(row => row.position) };
}

function recruitsData() {
  const prospects = loadRecruitingClass().prospects || [];
  return { prospects };
}

function rosterData() {
  return loadRutgersRoster();
}

function recruitingSettings() {
  return typeof COACH_RECRUITING_MODIFIERS !== "undefined" ? COACH_RECRUITING_MODIFIERS : { priority_weights: {}, missing_metric_behavior: "neutral" };
}

function recruitingPerformance() {
  return { metrics: {}, missing_metric_behavior: "neutral" };
}

function validateGameplanWeekly(plan) {
  if (!plan || typeof plan !== "object") throw new Error("Gameplan package must be an object");
  if (plan.package_type !== "gameplan_weekly_update") throw new Error("Wrong package_type for gameplan import");
  if (!plan.opponent_profile || !plan.quick_tactical_summary || !plan.usage_plan) throw new Error("Gameplan package missing enriched gameplan fields");
  return true;
}

function validateRecruitingWeekly(plan) {
  if (!plan || typeof plan !== "object") throw new Error("Recruiting package must be an object");
  if (plan.package_type !== "recruiting_weekly_update") throw new Error("Wrong package_type for recruiting import");
  if (!plan.resources || !Array.isArray(plan.active_board) || !Array.isArray(plan.team_needs)) throw new Error("Recruiting package missing resources, active_board, or team_needs");
  return true;
}

function renderGamedayHeader() {
  const roster = loadRutgersRoster();
  const team = roster.team || {};
  const opp = loadOpponentProfile();
  setText("programLabel", "Rutgers Football");
  setText("appTitle", "Gameday Gameplan");
  setText("weekOpponent", `${activeWeekLabel()} vs ${activeOpponentName()}`);
  setText("seasonRecord", team.record);
  setText("rutgersRank", TEAM_PROFILE && TEAM_PROFILE.rutgers_rank ? TEAM_PROFILE.rutgers_rank : "#18");
  setText("offenseRank", team.offense);
  setText("defenseRank", team.defense);
  setText("momentumStatus", `${activeOpponentName()} package loaded`);
}

function renderGameMatchupHeader() {
  const team = loadRutgersRoster().team || {};
  const opp = loadOpponentProfile();
  const summary = loadGameplanWeekly().quick_tactical_summary || {};
  return `<section class="panel matchup-hero compact-matchup-strip">
    <div class="team-line"><strong>Rutgers</strong><span>${cleanValue(team.record)}</span><em>OVR ${cleanValue(team.overall)} | OFF ${cleanValue(team.offense)} | DEF ${cleanValue(team.defense)}</em></div>
    <div class="versus">VS</div>
    <div class="team-line"><strong>${activeOpponentName()}</strong><span>${cleanValue(opp.record)} ${cleanValue(opp.conference_record) ? `(${opp.conference_record})` : ""}</span><em>OVR ${cleanValue(opp.overall)} | OFF ${cleanValue(opp.offense_overall)} | DEF ${cleanValue(opp.defense_overall)}</em></div>
    <div class="game-strip">${maybeRow("Week", activeWeekLabel())}${maybeRow("Confidence", matchupConfidence() || (summary.best_protection_rule ? "Protection plan loaded" : ""))}</div>
  </section>`;
}

function estimateSuccess(play) {
  return `${Math.max(45, Math.min(92, Math.round(play.score)))}%`;
}

function yppEstimate(play) {
  const metrics = playHistoryMetrics(play);
  return metrics.yardsPerPlay ? metrics.yardsPerPlay : "";
}

function conceptType(play) {
  return conceptFamily(play);
}

function playPersonnel(play) {
  return play.personnel || play.personnelGrouping || (play.formation && play.formation.includes("Gun") ? "11 personnel" : "");
}

function tacticalMatchupFor(play) {
  const family = conceptFamily(play).toLowerCase();
  const groups = loadOpponentGroups();
  if (family.includes("run")) return groups.find(g => /Interior|Linebackers/i.test(g.group)) || groups[0] || {};
  if (family.includes("pass") || family.includes("rpo")) return groups.find(g => /Linebackers|Edge/i.test(g.group)) || groups[0] || {};
  return groups[0] || {};
}

function bestCallCard(play, rankNumber, label) {
  const group = tacticalMatchupFor(play);
  const summary = loadGameplanWeekly().quick_tactical_summary || {};
  const reason = explanationText(play).split(". ").slice(0, 1).join(". ");
  return `<article class="premium-card compact-best">
    <div class="best-head">
      <div class="rank-badge">B${rankNumber}</div>
      <div>
        <div class="card-label">${label}</div>
        <h2>${play.name}</h2>
        <div class="play-meta">
          <span class="chip">${play.formation}</span>
          ${cleanValue(playPersonnel(play)) ? `<span class="chip">${cleanValue(playPersonnel(play))}</span>` : ""}
          <span class="chip">${conceptType(play)}</span>
          <span class="risk ${play.risk}">${play.risk} risk</span>
        </div>
      </div>
      <div class="score">${scoreLetter(play.score)}<span>${play.score} internal</span></div>
    </div>
    <figure class="play-diagram large-diagram">
      <img src="${play.diagramPath || 'assets/play-diagrams/formation-fallback.svg'}" alt="${play.name}" loading="lazy" onerror="this.src='assets/play-diagrams/formation-fallback.svg'">
    </figure>
    <div class="metrics-grid compact-metrics">
      ${maybeRow("Confidence", play.score >= 82 ? "High" : play.score >= 72 ? "Medium" : "Caution")}
      ${maybeRow("Success estimate", estimateSuccess(play))}
      ${maybeRow("Primary", play.primaryPlayerName)}
      ${maybeRow("Run direction", (summary.best_run_ideas || [])[0])}
      ${maybeRow("Protection", summary.best_protection_rule)}
    </div>
    <div class="why-box compact-why">
      <strong>Why this play?</strong>
      <p>${reason}${reason.endsWith(".") ? "" : "."}</p>
    </div>
    <div class="compact-actions">
    <details class="breakout"><summary>View Full Breakdown</summary>
      <div class="card-grid">
        ${maybeRow("Yards / play", yppEstimate(play))}
        ${maybeRow("Secondary", play.secondaryPlayerName)}
        ${maybeRow("Situation fit", signed(play.situationModifier))}
        ${maybeRow("Personnel fit", signed(play.personnelFit))}
        ${maybeRow("Opponent fit", signed(play.matchupModifier))}
      </div>
      <p>${explanationText(play)}</p>${scoreBreakdown(play)}
    </details>
    <details class="breakout"><summary>View Matchup Detail</summary>
      ${maybeRow("Weak defender attacked", group.weakness)}
      ${maybeRow("Strong defender avoided", group.key_player)}
      ${maybeRow("Run lane", (summary.best_run_ideas || [])[0])}
      ${maybeRow("Protection recommendation", summary.best_protection_rule)}
    </details>
    </div>
  </article>`;
}

function renderTopAlternatives(picks) {
  if (!$("top3Inline")) return;
  $("top3Inline").innerHTML = `<div class="section-heading"><p>Top 3 Alternatives</p><strong><button class="text-link" type="button" onclick="switchTab('topplays')">View All Plays</button></strong></div>` +
    (picks.length ? `<div class="alt-strip">${picks.slice(0, 3).map((play, i) => `<details class="alt-card compact-alt">
      <summary>
        <span class="rank-dot">${i + 1}</span>
        <img src="${play.diagramPath || 'assets/play-diagrams/formation-fallback.svg'}" alt="" loading="lazy">
        <strong>${play.name}</strong>
        <em>${scoreLetter(play.score)}</em>
      </summary>
      <div class="small">${play.formation} | ${conceptType(play)} | ${play.risk} risk</div>
      ${maybeRow("Success", estimateSuccess(play))}
      ${maybeRow("Best usage", play.objective)}
      <p class="small">${explanationText(play)}</p>
    </details>`).join("")}</div>` : `<p class="small">Tap Show Top 3 Plays to populate alternatives.</p>`);
}

function renderGameplanPanels() {
  const weekly = loadGameplanWeekly();
  const summary = weekly.quick_tactical_summary || {};
  const usage = weekly.usage_plan || {};
  const risk = highestRiskMatchup();
  if ($("quickSummary")) {
    $("quickSummary").innerHTML = `<div class="section-heading"><p>Quick Tactical Summary</p><strong>Live answers</strong></div>
      <div class="summary-grid compact-grid">
        ${maybeRow("Best run direction", (summary.best_run_ideas || [])[0])}
        ${maybeRow("Best pass concept", summary.primary_attack)}
        ${maybeRow("Protection call", summary.best_protection_rule)}
        ${maybeRow("Third-down identity", "RPO / Quick Game")}
      </div>
      <details class="breakout compact-detail"><summary>More tactical detail</summary>
        <div class="summary-grid">${maybeRow("Avoid run direction", (summary.avoid || [])[0])}${maybeRow("Blitz alert", "Use quick game if edge pressure repeats")}${maybeRow("Weak defender to attack", loadOpponentGroups().map(g => g.weakness).filter(Boolean)[0])}${maybeRow("Elite defender to avoid", cleanValue(risk.opponent_player) || keyOpponentPlayer(/edge|rusher/i))}${maybeRow("Shot trigger", "After efficient quick game or inside run")}${maybeRow("Red-zone identity", "Power Run / Play Action")}${maybeRow("Tempo", "Normal with tempo after substitutions")}</div>
      </details>`;
  }
  if ($("gameDayUsage")) {
    $("gameDayUsage").innerHTML = `<div class="section-heading"><p>Usage Plan</p><strong>Target mix</strong></div>
      <div class="usage-strip">
        ${["run_percent","pass_percent","rpo_percent","play_action_percent","screen_percent","designed_qb_percent"].map(key => maybeRow(labelize(key), usage[key] !== undefined ? `${usage[key]}%` : "")).join("")}
      </div>
      <details class="breakout compact-detail"><summary>Usage detail</summary>
        ${maybeRow("Featured players", Object.values(weeklyPlayers()).filter(p => /Featured|High Usage|Starting/i.test(p.priorityLabel || p.weeklyRole || "")).map(p => p.name))}
        ${maybeRow("Preferred formations", [...new Set(RUTGERS_PLAYBOOK.slice(0, 20).map(p => p.formation))].slice(0, 4))}
        ${maybeRow("Preferred personnel", "11 personnel, 12 personnel when chip help is needed")}
        ${maybeRow("Workload warnings", usage.note)}
      </details>`;
  }
  if ($("gameDayAlerts")) {
    const alerts = [...(WEEKLY_PLAN.warnings || []), ...((summary.avoid || []).map(item => `Avoid: ${item}`))].slice(0, 4);
    $("gameDayAlerts").innerHTML = alerts.length ? `<details class="breakout compact-detail"><summary>Game-Day Alerts</summary>${alerts.map(alert => `<div class="notice warn">${alert}</div>`).join("")}</details>` : "";
  }
}

function renderStatic() {
  renderGamedayHeader();
  if ($("gameplan")) {
    const matchup = renderGameMatchupHeader();
    if (!$("gameMatchupHeader")) $("gameplan").insertAdjacentHTML("afterbegin", `<div id="gameMatchupHeader">${matchup}</div>`);
    else $("gameMatchupHeader").innerHTML = matchup;
  }
  if ($("scriptList")) $("scriptList").innerHTML = WEEKLY_PLAN.openingScript.map((id, i) => {
    const play = playMap().get(id);
    return play ? `<div class="script-row"><span>${i + 1}</span><strong>${play.name}</strong><em>${play.formation}</em></div>` : "";
  }).join("");
  if ($("gameplanScoutList")) $("gameplanScoutList").innerHTML = loadOpponentGroups().map(group => `<div class="scout-card"><h3>${group.group}</h3>${maybeRow("Strength", group.strength)}${maybeRow("Key player", group.key_player)}${maybeRow("Weakness", group.weakness)}${maybeRow("Attack plan", group.attack_plan)}</div>`).join("");
  renderUsage();
  renderPersonnelMatchups();
  renderGameplanPanels();
  renderPackagePanel();
  renderRecruiting();
}

function renderRanks() {
  if (!$("topplays")) return;
  const q = $("search") ? $("search").value.toLowerCase() : "";
  const family = $("rankFamily") ? $("rankFamily").value : "all";
  const formation = $("rankFormation") ? $("rankFormation").value : "all";
  const personnel = $("rankPersonnel") ? $("rankPersonnel").value : "all";
  const risk = $("rankRisk") ? $("rankRisk").value : "all";
  const situation = $("rankSituation") ? $("rankSituation").value : "all";
  const favorites = favoritePlayIds();
  const list = state.ranked.filter(play => {
    const type = conceptFamily(play);
    const passBucket = ["quick pass", "intermediate pass", "deep pass"].includes(type);
    if (family === "run" && !type.includes("run") && type !== "option") return false;
    if (family === "pass" && !passBucket) return false;
    if (family === "rpo" && type !== "RPO") return false;
    if (family === "pa" && type !== "play action") return false;
    if (family === "screen" && type !== "screen") return false;
    if (!["all","favorites","run","pass","rpo","pa","screen"].includes(family) && type !== family) return false;
    if (family === "favorites" && !favorites.has(play.id)) return false;
    if (formation !== "all" && play.formation !== formation) return false;
    if (personnel !== "all" && playPersonnel(play) !== personnel) return false;
    if (risk !== "all" && play.risk !== risk) return false;
    if (situation !== "all" && !(play.situations || []).includes(situation)) return false;
    return !q || play.name.toLowerCase().includes(q) || play.formation.toLowerCase().includes(q) || play.primaryPlayerName.toLowerCase().includes(q);
  });
  if (!$("topFilterBar")) {
    $("topplays").innerHTML = `<div class="section-heading"><p>Rutgers Football</p><strong>Top Plays</strong></div>
      <div id="topFilterBar" class="pill-row sticky-filter">
        ${["all","favorites","run","pass","rpo","pa","screen"].map(v => `<button class="filter-pill" data-filter="${v}" type="button">${v === "pa" ? "PA" : labelize(v)}</button>`).join("")}
      </div>
      <details class="breakout compact-detail"><summary>Advanced Filters</summary><div class="filter-grid dense-controls">
        <label>Formation<select id="rankFormation"></select></label>
        <label>Personnel<select id="rankPersonnel"><option value="all">All</option></select></label>
        <label>Situation<select id="rankSituation"></select></label>
        <label>Risk<select id="rankRisk"><option value="all">All</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        <label>Field zone<select id="rankZone"><option value="all">All</option></select></label>
        <label>Game state<select id="rankState"><option value="all">All</option></select></label>
      </div></details>
      <input id="search" placeholder="Search play, formation, or player"><div id="rankList"></div>`;
    populateRankFilters();
    $("search").addEventListener("input", renderRanks);
    ["rankFormation","rankPersonnel","rankSituation","rankRisk"].forEach(id => $(id).addEventListener("change", renderRanks));
    document.querySelectorAll(".filter-pill").forEach(btn => btn.addEventListener("click", () => { $("rankFamily").value = btn.dataset.filter; renderRanks(); }));
  }
  const target = $("rankList");
  if (target) target.innerHTML = list.map((play, i) => callCard(play, i + 1)).join("");
}

function populateRankFilters() {
  if (!$("rankFamily")) {
    const select = document.createElement("select");
    select.id = "rankFamily";
    select.hidden = true;
    document.body.appendChild(select);
  }
  $("rankFamily").innerHTML = `<option value="all">All</option><option value="favorites">Favorites</option><option value="run">Run</option><option value="pass">Pass</option><option value="rpo">RPO</option><option value="pa">Play Action</option><option value="screen">Screen</option>`;
  if ($("rankFormation")) {
    const formations = [...new Set(RUTGERS_PLAYBOOK.map(play => play.formation))].sort();
    $("rankFormation").innerHTML = `<option value="all">All</option>${formations.map(row => `<option value="${row}">${row}</option>`).join("")}`;
  }
  if ($("rankSituation")) {
    const situations = [...new Set(RUTGERS_PLAYBOOK.flatMap(play => play.situations || []))].sort();
    $("rankSituation").innerHTML = `<option value="all">All</option>${situations.map(row => `<option value="${row}">${labelize(row)}</option>`).join("")}`;
  }
  if ($("rankPersonnel")) {
    const personnel = [...new Set(RUTGERS_PLAYBOOK.map(play => playPersonnel(play)).filter(cleanValue))].sort();
    $("rankPersonnel").innerHTML = `<option value="all">All</option>${personnel.map(row => `<option value="${row}">${row}</option>`).join("")}`;
  }
}

function callCard(play, rankNumber) {
  const starred = favoritePlayIds().has(play.id);
  return `<details class="play-card compact-play-row">
    <summary>
      <span class="rank-dot">${rankNumber}</span>
      <img src="${play.diagramPath || 'assets/play-diagrams/formation-fallback.svg'}" alt="" loading="lazy">
      <span><strong><mark class="grade-badge">${scoreLetter(play.score)}</mark> ${play.name}</strong><em>${play.formation} | ${conceptType(play)}</em></span>
      <b>${scoreLetter(play.score)}<em>${play.score} / ${play.risk}</em></b>
      <button class="icon-favorite ${starred ? "active" : ""}" type="button" aria-label="${starred ? "Remove favorite" : "Add favorite"}" onclick="event.preventDefault();event.stopPropagation();toggleFavoritePlay('${play.id}')">${starred ? "★" : "☆"}</button>
    </summary>
    <div class="card-grid">
      ${maybeRow("Personnel", playPersonnel(play))}
      ${maybeRow("Success rate", estimateSuccess(play))}
      ${maybeRow("Yards/play", yppEstimate(play))}
      ${maybeRow("Risk", play.risk)}
      ${maybeRow("Best down/distance", play.objective)}
      ${maybeRow("Best field zone", (play.eligibleFieldZones || []).join(", "))}
      ${maybeRow("Best game state", (play.eligibleGameStates || []).join(", "))}
      ${maybeRow("Matchup boost", signed(play.matchupModifier))}
      ${maybeRow("Protection effect", (loadGameplanWeekly().quick_tactical_summary || {}).best_protection_rule)}
      ${maybeRow("Recent-use penalty", signed(play.recentCallPenalty))}
    </div>
    <figure class="play-diagram"><img src="${play.diagramPath || 'assets/play-diagrams/formation-fallback.svg'}" alt="${play.name}" loading="lazy"></figure>
    <div class="why-box"><strong>Why it ranked here</strong><p>${explanationText(play)}</p>${scoreBreakdown(play)}</div>
    ${maybeRow("Rutgers strength used", play.primaryPlayerName)}
    ${maybeRow("Opponent weakness attacked", (tacticalMatchupFor(play) || {}).weakness)}
    ${maybeRow("Protection rule", (loadGameplanWeekly().quick_tactical_summary || {}).best_protection_rule)}
    ${maybeRow("Setup value", signed(play.setupBonus))}
    ${maybeRow("Repetition penalty", signed(play.recentCallPenalty))}
  </details>`;
}

function renderPersonnelMatchups(active = "overview") {
  if (!$("personnel")) return;
  const tabs = ["overview","rutgers","oline","run","protection","opponent","matchups","stats","scouting"];
  const tabLabel = id => ({ overview: "Home", rutgers: "Roster", oline: "O-Line", protection: "Protect", opponent: "Opp", matchups: "Match", scouting: "Scout" }[id] || labelize(id));
  $("personnel").innerHTML = `<div class="section-heading"><p>Rutgers Football</p><strong>Personnel & Matchups</strong></div>
    <div class="segmented sticky-internal compact-tabs">${tabs.map(id => `<button type="button" class="${id === active ? "active" : ""}" onclick="renderPersonnelMatchups('${id}')">${tabLabel(id)}</button>`).join("")}</div>
    <div id="personnelPanel">${renderPersonnelPanel(active)}</div>`;
}

function renderPersonnelPanel(active) {
  if (active === "overview") return renderPersonnelOverview();
  if (active === "rutgers") return renderRosterCards();
  if (active === "run") return renderRunDirection();
  if (active === "protection") return renderProtection();
  if (active === "opponent") return renderOpponent();
  if (active === "matchups") return renderMatchups();
  if (active === "oline") return renderOLine();
  if (active === "stats") return renderStatsWorkspace();
  if (active === "scouting") return renderScoutingReport();
  return "";
}

function renderPersonnelOverview() {
  const lanes = runLaneModel();
  const bestLane = (lanes.find(row => row.status === "feature") || lanes[0] || {}).lane;
  const risk = highestRiskMatchup();
  const featured = (loadRutgersRoster().players || []).find(p => /QB|HB|WR|TE/.test(p.position)) || {};
  const featuredSummary = featured.player_id ? `<button class="summary-player-card" type="button" onclick="renderPersonnelMatchups('rutgers');setTimeout(()=>showRosterGroup('${rosterGroupFor(featured.position)}'),0)">${portraitImg(featured, "rutgers")}<span><strong>${featured.name}</strong><em>${featured.position} | OVR ${featured.overall}</em></span></button>` : "";
  const riskText = riskSummary(risk);
  return `${renderGameMatchupHeader().replace('<section class="panel matchup-hero">','<section class="panel matchup-hero compact overview-matchup">')}
    <div class="summary-grid compact-grid">
      ${maybeRow("Best run lane", bestLane)}
      ${maybeRow("Protection call", (loadGameplanWeekly().quick_tactical_summary || {}).best_protection_rule)}
    </div>
    <div class="featured-risk-grid">
      <section><h3>Featured Player</h3>${featuredSummary || renderStatPlaceholder("Featured Player", "Limited data")}</section>
      <section><h3>Biggest Risk</h3><button class="risk-link" type="button" onclick="renderPersonnelMatchups('matchups')"><strong>${riskText || "Limited data"}</strong><span>Tap to view matchup detail</span></button></section>
    </div>
    <h3>Key Matchups</h3>
    <div class="compact-list">${(loadMatchups() || []).slice(0, 3).map(row => matchupRow(row)).join("")}</div>`;
}

function renderRosterCards(activeGroup = "QB") {
  const groups = ROSTER_POSITION_GROUPS.map(group => ({ group, players: groupRosterPlayers(group) }));
  const selected = ROSTER_POSITION_GROUPS.includes(activeGroup) ? activeGroup : (groups.find(row => row.players.length) || {}).group || "QB";
  const players = groupRosterPlayers(selected);
  return `<div class="position-rail">${groups.map(row => {
    const starter = row.players[0] || {};
    return `<button type="button" class="position-box ${row.group === selected ? "active" : ""}" onclick="showRosterGroup('${row.group}')">
      <strong>${row.group}</strong>
      <span>${cleanValue(starter.name) || "No verified player"}</span>
      <em>${cleanValue(starter.overall) ? `OVR ${starter.overall}` : ""}</em>
      <small>${row.players.length} players</small>
      <b>${positionStatus(row.players)}</b>
    </button>`;
  }).join("")}</div>
  <div class="section-heading compact-heading"><p>Roster Group</p><strong>${selected}</strong></div>
  <div class="compact-list">${players.length ? players.map(player => premiumPlayerCard(player, "rutgers")).join("") : renderStatPlaceholder(selected, "No verified players were provided for this position group.")}</div>`;
}

function runLaneModel() {
  const summary = loadGameplanWeekly().quick_tactical_summary || {};
  const avoid = summary.avoid || [];
  const ideas = summary.best_run_ideas || [];
  return [
    { lane: "Left edge", status: "situational", recommendation: "Use only when motion or leverage creates a clean edge.", concepts: ideas.filter(x => /counter|lateral|misdirection/i.test(x)) },
    { lane: "Left tackle", status: "feature", recommendation: "Primary away-from-pressure lane when the front allows.", concepts: ideas.filter(x => /inside|zone|counter/i.test(x)) },
    { lane: "Left guard", status: "situational", recommendation: "Use with double teams or misdirection.", concepts: ideas.filter(x => /trap|wham|zone/i.test(x)) },
    { lane: "Middle", status: "situational", recommendation: firstClean(ideas.filter(x => /trap|wham|inside|zone/i.test(x))), concepts: ideas.filter(x => /trap|wham|inside|zone/i.test(x)) },
    { lane: "Right guard", status: "feature", recommendation: firstClean(ideas), concepts: ideas.slice(0, 3) },
    { lane: "Right tackle", status: "avoid", recommendation: firstClean(avoid), concepts: ideas.filter(x => /counter|screen|lateral/i.test(x)) },
    { lane: "Right edge", status: "avoid", recommendation: firstClean(avoid.filter(x => /edge|tackle|isolation/i.test(x))) || firstClean(avoid), concepts: [] }
  ];
}

function renderRunDirection() {
  const lanes = runLaneModel();
  const best = lanes.find(row => row.status === "feature") || lanes[0];
  const avoid = lanes.find(row => row.status === "avoid") || {};
  return `<div class="lane-map compact-lane-map">${lanes.map(row => `<details class="lane ${row.status}"><summary><strong>${row.lane}</strong><span>${row.status}</span></summary><p>${cleanValue(row.recommendation)}</p>${maybeRow("Recommended concepts", row.concepts)}</details>`).join("")}</div>
    <div class="summary-grid compact-grid">${maybeRow("Best run lane", best.lane)}${maybeRow("Worst run lane", avoid.lane)}${maybeRow("Short-yardage", firstClean(lanes.filter(row => /Middle|Guard/i.test(row.lane) && row.status !== "avoid").map(row => row.lane)))}${maybeRow("Explosive-run lane", firstClean(lanes.filter(row => row.concepts && row.concepts.some(c => /counter|misdirection|lateral/i.test(c))).map(row => row.lane)))}</div>
    <details class="breakout compact-detail"><summary>Run detail</summary>${maybeRow("Why", (loadGameplanWeekly().quick_tactical_summary || {}).secondary_attack)}${maybeRow("Recommended concepts", (loadGameplanWeekly().quick_tactical_summary || {}).best_run_ideas)}</details>`;
}

function renderProtection() {
  const risk = highestRiskMatchup();
  const edgeNames = (loadOpponentPlayers() || []).filter(p => /edge|ledg|redg/i.test(cleanValue(p.position))).map(p => p.name);
  const interiorNames = (loadOpponentPlayers() || []).filter(p => /dt|nt|dtck/i.test(cleanValue(p.position))).map(p => p.name);
  const pressures = [
    { gap: "Left edge", status: "standard", source: edgeNames[0], adjustment: "Use normal rules unless pressure repeats." },
    { gap: "Left B-gap", status: "situational", source: interiorNames[0], adjustment: "Use combo help when aligned inside." },
    { gap: "Left A-gap", status: "situational", source: "Interior movement", adjustment: "Keep quick answers available." },
    { gap: "Right A-gap", status: "situational", source: "Interior movement", adjustment: "Avoid slow interior concepts versus quick penetration." },
    { gap: "Right B-gap", status: "caution", source: interiorNames[0], adjustment: "Scan and help if pressure appears." },
    { gap: "Right edge", status: "danger", source: cleanValue(risk.opponent_player) || edgeNames[1] || edgeNames[0], adjustment: firstClean(risk.recommendations) || "Chip, slide, or move the launch point." }
  ];
  const summary = loadGameplanWeekly().quick_tactical_summary || {};
  const recs = risk.recommendations || [];
  return `<div class="pressure-map compact-pressure-map">${pressures.map(row => `<details class="pressure ${row.status}"><summary><strong>${row.gap}</strong><span>${cleanValue(row.source)}</span></summary><p>${cleanValue(row.adjustment)}</p></details>`).join("")}</div>
    <div class="summary-grid compact-grid">${maybeRow("Slide", summary.best_protection_rule)}${maybeRow("Elite rusher", cleanValue(risk.opponent_player))}${maybeRow("Weak blocker", cleanValue(risk.rutgers_unit))}${maybeRow("Quick trigger", recs.filter(x => /quick/i.test(x)))}</div>
    <details class="breakout compact-detail"><summary>Protection detail</summary>${maybeRow("RB chip", recs.filter(x => /RB|scan|chip/i.test(x)))}${maybeRow("TE chip", recs.filter(x => /TE|chip/i.test(x)))}${maybeRow("Max protect", recs.filter(x => /max/i.test(x)))}${maybeRow("Screen trigger", recs.filter(x => /screen/i.test(x)))}${maybeRow("Boot direction", recs.filter(x => /boot/i.test(x)))}${maybeRow("Rule", summary.best_protection_rule)}</details>`;
}

function renderOpponent() {
  const players = loadOpponentPlayers();
  const groups = loadOpponentGroups();
  const byGroup = groupOpponentPlayers(players);
  return `<h3>${activeOpponentName()} Scouting</h3>${groups.map(group => `<details class="scout-card compact-accordion"><summary><strong>${group.group}</strong><span>${cleanValue(group.strength)}</span></summary>${maybeRow("Key player", group.key_player)}${maybeRow("Weakness", group.weakness)}${maybeRow("Attack plan", group.attack_plan)}<div class="compact-list">${(byGroup[group.group] || []).map(player => opponentPlayerCard(player)).join("")}</div></details>`).join("")}`;
}

function groupOpponentPlayers(players) {
  const buckets = { Edge: [], "Defensive Interior": [], Linebackers: [], Secondary: [] };
  players.forEach(player => {
    const pos = cleanValue(player.position);
    if (/edge|ledg|redg/i.test(pos)) buckets.Edge.push(player);
    else if (/dt|nt|tck/i.test(pos)) buckets["Defensive Interior"].push(player);
    else if (/lb|mike/i.test(pos)) buckets.Linebackers.push(player);
    else buckets.Secondary.push(player);
  });
  return buckets;
}

function opponentPlayerCard(player) {
  const a = player.ui_analysis || {};
  const seasonRows = statsForPlayer(player, loadOpponentSeasonStats());
  const lastRows = statsForPlayer(player, loadOpponentLastGameStats());
  return `<details class="person-card compact-person premium-player-card player-detail"><summary>${portraitImg(player, "opponent")}<span><strong>${player.name}</strong><em>${player.position} | ${player.year}${player.redshirt ? " (RS)" : ""} | OVR ${player.overall}</em></span><b>${cleanValue(a.matchup_priority) || "Threat"}</b></summary>
    <div class="player-card-grid"><div class="portrait-panel">${portraitImg(player, "opponent", "player-portrait large")}</div><div class="card-grid">${maybeRow("Overall", player.overall)}${maybeRow("Position", player.position)}${maybeRow("Attributes", topAttributes(player, 6), "Limited data")}${maybeRow("Threat level", a.matchup_priority || player.archetype)}${maybeRow("Matchup Summary", matchupSummaryForPlayer(player, "opponent"), "Limited data")}</div></div>
    <div class="production-grid">${statBlock("Last Game", lastRows)}${statBlock("Season", seasonRows)}</div>
    ${maybeRow("Archetype", player.archetype)}${maybeRow("Scouting summary", a.summary || player.description)}${maybeRow("Top attributes", a.strengths)}
    ${maybeRow("Strengths", a.strengths, "Limited data")}${maybeRow("Weaknesses", a.weaknesses, "Limited data")}${maybeRow("Concepts to increase", a.gameplan_increase)}${maybeRow("Concepts to decrease", a.gameplan_decrease)}${maybeRow("Matchup recommendation", a.in_game_trigger)}
  </details>`;
}

function renderScoutingReport() {
  const profile = loadOpponentProfile();
  const groups = loadOpponentGroups();
  const players = loadOpponentPlayers();
  const byGroup = groupOpponentPlayers(players);
  const increases = players.flatMap(player => (player.ui_analysis || {}).gameplan_increase || []).filter(cleanValue);
  const decreases = players.flatMap(player => (player.ui_analysis || {}).gameplan_decrease || []).filter(cleanValue);
  const triggers = players.map(player => (player.ui_analysis || {}).in_game_trigger).filter(cleanValue);
  return `<div class="summary-grid compact-grid">
      ${maybeRow("Opponent", `${cleanValue(profile.team)} ${cleanValue(profile.nickname)}`)}
      ${maybeRow("Record", `${cleanValue(profile.record)} ${cleanValue(profile.conference_record) ? `(${profile.conference_record})` : ""}`)}
      ${maybeRow("Overall", profile.overall)}
      ${maybeRow("Defense", profile.defense_overall)}
    </div>
    <details class="scout-card compact-detail" open><summary>Strengths & Weaknesses</summary>
      ${maybeRow("Strengths", groups.map(group => group.strength))}
      ${maybeRow("Weaknesses", groups.map(group => group.weakness))}
      ${maybeRow("Concepts to increase", [...new Set(increases)].slice(0, 8))}
      ${maybeRow("Concepts to avoid", [...new Set(decreases)].slice(0, 8))}
    </details>
    <details class="scout-card compact-detail"><summary>Position-Group Scouting</summary>
      ${groups.map(group => `<div class="scout-slice"><strong>${group.group}</strong>${maybeRow("Key player", group.key_player)}${maybeRow("Strength", group.strength)}${maybeRow("Weakness", group.weakness)}${maybeRow("Attack plan", group.attack_plan)}</div>`).join("")}
    </details>
    <details class="scout-card compact-detail"><summary>Key Players & Triggers</summary>
      <div class="compact-list">${players.slice(0, 6).map(player => opponentPlayerCard(player)).join("")}</div>
      ${maybeRow("In-game triggers", triggers.slice(0, 8))}
    </details>
    <details class="scout-card compact-detail"><summary>Front, Pressure, Coverage</summary>
      ${maybeRow("Blitz tendencies", groups.map(group => /edge|linebacker/i.test(group.group) ? group.attack_plan : "").filter(cleanValue))}
      ${maybeRow("Coverage tendencies", groups.map(group => /secondary|linebacker/i.test(group.group) ? group.strength : "").filter(cleanValue))}
      ${maybeRow("Run-front tendencies", groups.map(group => /interior|edge|linebacker/i.test(group.group) ? group.strength : "").filter(cleanValue))}
    </details>`;
}

function renderMatchups() {
  const ordered = orderedMatchupRows();
  const top = ordered.slice(0, 3);
  const rest = ordered.slice(3);
  return `<section class="matchup-card-system" data-valid-count="${ordered.length}">
    <div class="section-heading compact-heading"><p>Personnel Match</p><strong>Key Matchups</strong></div>
    <div class="compact-list matchup-card-list">${top.map(item => MatchupCard(item.row, item.rutgers, item.opponent, matchupCardStats(item.rutgers, item.opponent), matchupCardMedia(item.rutgers, item.opponent), { rank: item.sourceIndex + 1, key: true })).join("") || renderStatPlaceholder("Key Matchups", "Limited data")}</div>
    <div class="matchup-action-row">
      <button type="button" onclick="const d=document.getElementById('allMatchupsPanel'); if(d)d.open=!d.open;">All Matchups</button>
      <button type="button" onclick="renderPersonnelMatchups('scouting')">Scouting Report</button>
    </div>
    ${rest.length ? `<details id="allMatchupsPanel" class="breakout compact-detail all-matchups-panel"><summary>View All Matchups</summary><div class="compact-list matchup-card-list">${rest.map(item => MatchupCard(item.row, item.rutgers, item.opponent, matchupCardStats(item.rutgers, item.opponent), matchupCardMedia(item.rutgers, item.opponent), { rank: item.sourceIndex + 1 })).join("")}</div></details>` : ""}</section>`;
}

function matchupRow(row) {
  const rutgers = findRutgersMatchupPlayer(row);
  const opponent = findOpponentMatchupPlayer(row);
  return MatchupCard(row, rutgers, opponent, matchupCardStats(rutgers, opponent), matchupCardMedia(rutgers, opponent));
}

function matchupCardStats(rutgers, opponent) {
  return {
    rutgersLast: rutgers && (rutgers.last_game ? [rutgers.last_game] : statsForPlayer(rutgers, loadRutgersLastGameStats())),
    rutgersSeason: rutgers && (rutgers.season ? [rutgers.season] : statsForPlayer(rutgers, loadRutgersSeasonStats())),
    opponentLast: opponent && (opponent.last_game ? [opponent.last_game] : statsForPlayer(opponent, loadOpponentLastGameStats())),
    opponentSeason: opponent && (opponent.season ? [opponent.season] : statsForPlayer(opponent, loadOpponentSeasonStats()))
  };
}

function matchupCardMedia(rutgers, opponent) {
  return {
    rutgers: mediaForPlayer(rutgers, "rutgers"),
    opponent: mediaForPlayer(opponent, "opponent")
  };
}

function MatchupCard(row, rutgers, opponent, stats = matchupCardStats(rutgers, opponent), media = matchupCardMedia(rutgers, opponent), options = {}) {
  const rutgersTitle = rutgers ? `${rutgers.name} (${rutgers.position})` : row.rutgers_unit;
  const opponentTitle = opponent ? `${opponent.name} (${opponent.position})` : cleanValue(row.opponent_player);
  const recommendations = row.tactical_recommendations || row.recommendations || [];
  const evidence = (row.evidence || []).map(item => typeof item === "object" ? `${cleanValue(item.metric || item.label || item.type || item.source)}: ${cleanValue(item.difference) ? `diff ${cleanValue(item.difference)}` : cleanValue(item.value || item.note || item.description)}` : item).filter(cleanValue);
  const limitations = row.data_limitations || [];
  const limited = limitations.length || !evidence.length;
  const priority = matchupPriority(row);
  const dataStatus = limited ? "Limited data" : "Verified matchup data";
  const rec = firstClean(recommendations);
  const remainingRows = remainingAttributeRows(rutgers, opponent, row.evidence || []);
  const edge = matchupEdgeDisplay(row);
  const support = tacticalSupport(row, evidence);
  return `<details class="match-card compact-match player-matchup matchup-card priority-${priority}" data-matchup-id="${cleanValue(row.matchup_id)}" data-priority="${priority}">
    <summary>
      <span class="match-thumb-pair">${rutgers ? portraitImg(rutgers, "rutgers", "player-portrait thumb") : ""}${opponent ? portraitImg(opponent, "opponent", "player-portrait thumb") : ""}</span>
      <span class="match-compact-copy"><strong>${rutgersTitle} <i>VS</i> ${opponentTitle}</strong><span>${cleanValue(row.advantage || row.status) || activeOpponentName()} | ${displayGrade(row.grade, row.internal_score)} | ${cleanValue(row.confidence) ? `${row.confidence}%` : "Limited data"}</span><em>${rec || "Limited data"}</em></span>
      <b class="priority-badge">${priority}</b>
    </summary>
    <div class="broadcast-matchup-grid">
      <div class="broadcast-player rutgers-side">${rutgers ? portraitImg(rutgers, "rutgers", "player-portrait broadcast") : ""}<span><strong>${cleanValue(rutgers && rutgers.name) || cleanValue(row.rutgers_unit)}</strong><em>${cleanValue(rutgers && rutgers.position)}${cleanValue(rutgers && rutgers.overall) ? ` | ${rutgers.overall} OVR` : ""}</em></span></div>
      <div class="broadcast-vs">VS</div>
      <div class="broadcast-player opponent-side">${opponent ? portraitImg(opponent, "opponent", "player-portrait broadcast") : ""}<span><strong>${cleanValue(opponent && opponent.name) || cleanValue(row.opponent_player)}</strong><em>${cleanValue(opponent && opponent.position)}${cleanValue(opponent && opponent.overall) ? ` | ${opponent.overall} OVR` : ""}</em></span></div>
    </div>
    <section class="matchup-edge broadcast-edge"><h4>Matchup Edge</h4><strong>${edge.title}</strong><span>${edge.meta || "Limited data"} | ${priority}</span></section>
    <section class="comparison-table broadcast-comparison"><h4>Selected Metrics</h4><div class="comparison-head"><span>Metric</span><strong>Rutgers</strong><em>Opponent</em><b>Edge</b></div>${attributeComparisonRows(rutgers, opponent, row.evidence || [], 4)}</section>
    <section class="match-production broadcast-production"><h4>Production</h4><div class="production-grid compact-production-grid">${compactProductionBlock("Rutgers Last Game", stats.rutgersLast)}${compactProductionBlock("Rutgers Season", stats.rutgersSeason)}${compactProductionBlock("Opponent Last Game", stats.opponentLast)}${compactProductionBlock("Opponent Season", stats.opponentSeason)}</div></section>
    <section class="tactical-callout"><h4>Tactical Recommendation</h4><strong>${rec || "Limited data"}</strong>${support ? `<p>${support}</p>` : ""}${cleanValue(row.confidence) ? `<span>${row.confidence}% confidence</span>` : ""}</section>
    <details class="nested-detail more-matchup-detail"><summary>More Detail</summary>
      ${remainingRows ? `<section class="comparison-table"><h4>Remaining Attributes</h4><div class="comparison-head"><span>Metric</span><strong>Rutgers</strong><em>Opponent</em><b>Edge</b></div>${remainingRows}</section>` : ""}
      <section class="evidence-detail"><h4>Evidence</h4>${evidenceRowsHtml(row.evidence || [])}</section>${maybeRow("Data limitations", limitations)}${maybeRow("Source status", dataStatus)}${maybeRow("Alternate recommendations", recommendations.slice(1))}${maybeRow("Secondary notes", row.description)}
    </details>
  </details>`;
}

function renderOLine() {
  const slots = ["LT","LG","C","RG","RT"];
  const starters = slots.map(slot => ({ slot, player: groupRosterPlayers(slot)[0] })).filter(row => row.player);
  const matched = loadMatchups().filter(row => row.rutgers_player && slots.includes(row.rutgers_player.position));
  const summary = loadGameplanWeekly().quick_tactical_summary || {};
  const recs = loadMatchups().flatMap(row => row.tactical_recommendations || row.recommendations || []);
  return starters.length ? `<div class="oline-alignment">${starters.map(({ slot, player }) => `<details class="oline-node"><summary><span>${slot}</span><strong>${player.name}</strong><em>${cleanValue(player.jersey_number) ? `#${player.jersey_number}` : `OVR ${player.overall}`}</em></summary>${maybeRow("Overall", player.overall)}${maybeRow("Ratings", topAttributes(player))}${maybeRow("Last Game", (matched.find(row => row.rutgers_player.player_id === player.player_id) || {}).rutgers_player && (matched.find(row => row.rutgers_player.player_id === player.player_id) || {}).rutgers_player.last_game)}${maybeRow("Season", (matched.find(row => row.rutgers_player.player_id === player.player_id) || {}).rutgers_player && (matched.find(row => row.rutgers_player.player_id === player.player_id) || {}).rutgers_player.season)}${maybeRow("Matchup", (matched.find(row => row.rutgers_player.player_id === player.player_id) || {}).opponent_player && `${(matched.find(row => row.rutgers_player.player_id === player.player_id) || {}).opponent_player.name} ${displayGrade((matched.find(row => row.rutgers_player.player_id === player.player_id) || {}).grade, (matched.find(row => row.rutgers_player.player_id === player.player_id) || {}).internal_score)}`)}</details>`).join("")}</div>
    <div class="oline-arrows">
      <div class="football-arrow run-arrow"><span>Run arrow</span><strong>${cleanValue(summary.best_run_ideas && summary.best_run_ideas[0]) || "No verified lane"}</strong></div>
      <div class="football-arrow protect-arrow"><span>Protection arrow</span><strong>${cleanValue(summary.best_protection_rule) || "No verified rule"}</strong></div>
      <div class="football-arrow double-arrow"><span>Double team</span><strong>${firstClean(recs.filter(text => /double/i.test(text))) || "Not available"}</strong></div>
      <div class="football-arrow chip-arrow"><span>Chip help</span><strong>${firstClean(recs.filter(text => /chip|help|scan/i.test(text))) || "Not available"}</strong></div>
    </div>
    <div class="summary-grid compact-grid">${maybeRow("Best run lane", summary.best_run_ideas && summary.best_run_ideas[0])}${maybeRow("Avoid lane", summary.avoid && summary.avoid[0])}${maybeRow("Protection direction", summary.best_protection_rule)}${maybeRow("Chip help", firstClean(recs.filter(text => /chip|help|scan/i.test(text))))}${maybeRow("Double team", firstClean(recs.filter(text => /double/i.test(text))))}</div>` : renderStatPlaceholder("O-Line", "No verified offensive-line alignment was provided.");
}

function renderStatsWorkspace() {
  const requested = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("stats") : "";
  const showSeason = requested === "season";
  const opponentLast = loadOpponentLastGameStats();
  const opponentSeason = loadOpponentSeasonStats();
  return `<div class="segmented compact-tabs stat-toggle">
      <button class="${!showSeason ? "active" : ""}" type="button" onclick="renderPersonnelMatchups('stats')">Last Game</button>
      <button class="${showSeason ? "active" : ""}" type="button" onclick="history.replaceState(null,'','?tab=personnel&personnel=stats&stats=season');renderPersonnelMatchups('stats')">Season</button>
    </div>
    <details class="breakout compact-detail" ${!showSeason ? "open" : ""}><summary>Rutgers Last Game Stat Sheet</summary>${renderStatSections("Last Game", loadRutgersLastGameStats())}</details>
    <details class="breakout compact-detail" ${showSeason ? "open" : ""}><summary>Rutgers Season Stat Sheet</summary>${renderStatSections("Season Stats", loadRutgersSeasonStats())}</details>
    <details class="breakout compact-detail"><summary>Opponent Last Game</summary>${renderStatSections("Opponent Last Game", opponentLast)}</details>
    <details class="breakout compact-detail"><summary>Opponent Season</summary>${renderStatSections("Opponent Season", opponentSeason)}</details>`;
}

function renderStatSections(title, data) {
  const categories = ["passing","rushing","receiving","offensive_line","defense","kicking","team_totals","third_down","red_zone","turnovers"];
  const entries = Object.entries(data || {}).filter(([, value]) => cleanValue(value) || (value && typeof value === "object" && Object.keys(value).some(key => cleanValue(value[key]))));
  if (!entries.length) return `<div class="stat-section-grid">${categories.map(key => `<article class="stat-card empty-stat"><h3>${labelize(key)}</h3><p>No verified ${title.toLowerCase()} values provided.</p></article>`).join("")}</div>`;
  const allEntries = categories.map(key => [key, data[key]]).filter(([, value]) => value !== undefined).concat(entries.filter(([key]) => !categories.includes(key)));
  return `<div class="stat-section-grid">${allEntries.map(([key, value]) => {
    if (Array.isArray(value)) return `<article class="stat-card stat-ticker"><h3>${labelize(key)}</h3><div class="stat-rail">${value.map(item => statChip(item)).join("")}</div></article>`;
    if (value && typeof value === "object") return `<article class="stat-card"><h3>${labelize(key)}</h3>${Object.entries(value).map(([k, v]) => maybeRow(labelize(k), v)).join("")}</article>`;
    return `<article class="stat-card"><h3>${labelize(key)}</h3>${maybeRow("Value", value)}</article>`;
  }).join("")}</div>`;
}

function statChip(item) {
  if (!item || typeof item !== "object") return cleanValue(item) ? `<div class="stat-chip"><strong>${cleanValue(item)}</strong></div>` : "";
  const entries = Object.entries(item).filter(([key, value]) => !["player_id"].includes(key) && cleanValue(value));
  const name = cleanValue(item.name || item.player || item.team || entries[0] && entries[0][1]);
  return `<div class="stat-chip"><strong>${name}</strong>${entries.filter(([key]) => !["name","player","team"].includes(key)).slice(0, 8).map(([key, value]) => `<span>${labelize(key)} ${cleanValue(value)}</span>`).join("")}</div>`;
}

function renderStatPlaceholder(title, message) {
  return `<div class="empty-state"><strong>${title}</strong><p>${message}</p></div>`;
}

function renderRecruiting() {
  renderHistory();
  if (!$("recruiting")) return;
  const weekly = loadRecruitingWeekly();
  const res = weekly.resources || {};
  const priorities = priorityBoard().slice(0, 8);
  $("recruiting").innerHTML = `<div class="section-heading"><p>Rutgers Football</p><strong>Recruiting</strong></div>
    <div class="overview-grid recruiting-overview">${maybeRow("Scholarships", `${res.scholarships_used} / ${res.scholarship_limit}`)}${maybeRow("Weekly hours", `${res.weekly_hours_used} / ${res.weekly_hours_total}`)}${maybeRow("Board", `${res.targets_used} / ${res.target_limit}`)}${maybeRow("Remaining", res.scholarships_remaining)}</div>
    <h3>Top Priority Positions</h3><div class="priority-chip-row horizontal-strip">${priorities.slice(0, 5).map(row => `<button class="priority-chip"><strong>${row.position}</strong><span>${row.tier}</span><em>${row.score}</em></button>`).join("")}</div>
    <div class="segmented compact-tabs recruiting-tabs"><button class="active" id="recruitBoardTab" type="button" onclick="renderRecruitList('board')">Recruiting Board</button><button id="prospectListTab" type="button" onclick="renderRecruitList('prospects')">Prospect List</button></div>
    <div id="actionPlanList"></div><div id="recruitList"></div><div id="recruitingFilters"></div>`;
  renderRecruitingFilters();
  renderRecruitList("board");
  renderActionPlan();
}

function priorityScore(positionNeed) {
  const position = positionNeed.position;
  const rosterCount = (loadRutgersRoster().players || []).filter(p => normalizePosition(p.position) === normalizePosition(position)).length;
  const prospects = (loadRecruitingClass().prospects || []).filter(p => normalizePosition(p.position) === normalizePosition(position));
  const deficit = Number(positionNeed.deficit ?? Math.max(0, (positionNeed.recommended_targets || 0) - (positionNeed.current_targets || 0)));
  const onField = 50;
  const depth = rosterCount ? Math.max(0, 24 - rosterCount * 3) : 24;
  const future = rosterCount <= 1 ? 12 : 6;
  const scheme = prospects.some(p => p.analysis && p.analysis.scheme_fit) ? 8 : 4;
  const target = Math.min(18, deficit * 5);
  const feasibility = prospects.length ? Math.min(12, prospects.length * 2) : 3;
  const score = Math.round((onField + depth + future + scheme + target + feasibility) * 10) / 10;
  return { position, score, tier: score >= 90 ? "Critical" : score >= 80 ? "High" : score >= 70 ? "Medium" : "Monitor", currentTargets: positionNeed.current_targets || 0, recommendedTargets: positionNeed.recommended_targets || 0, targetDeficit: deficit, coverageStatus: deficit > 0 ? "Under-covered" : "Covered" };
}

function priorityBoard() {
  return (loadRecruitingWeekly().team_needs || loadTeamNeeds().positions || []).map(need => priorityScore(need)).sort((a, b) => b.score - a.score || a.position.localeCompare(b.position));
}

function currentRecruitFilters() {
  return { bucket: $("filterBucket") ? $("filterBucket").value : "all", position: $("filterPosition") ? $("filterPosition").value : "all", priority: $("filterPriority") ? $("filterPriority").value : "all", stars: $("filterStars") ? $("filterStars").value : "all", q: $("filterSearch") ? $("filterSearch").value.toLowerCase() : "" };
}

function renderRecruitingFilters() {
  if (!$("recruitingFilters")) return;
  const positions = [...new Set([...(loadRecruitingWeekly().active_board || []), ...(loadRecruitingClass().prospects || [])].map(p => p.position).filter(Boolean))].sort();
  $("recruitingFilters").innerHTML = `<div class="pill-row sticky-filter">${["all","active","class","commits","visits","offered","scouted","gems"].map(v => `<button class="filter-pill recruit-chip" data-bucket="${v}" type="button">${v === "all" ? "All" : labelize(v)}</button>`).join("")}</div>
    <details class="breakout compact-detail"><summary>Advanced Filters</summary><div class="filter-grid dense-controls"><label class="hidden-filter">Board<select id="filterBucket"><option value="all">All</option><option value="active">Active targets</option><option value="class">Recruiting class</option><option value="commits">Commits</option><option value="visits">Visits</option><option value="offered">Offered</option><option value="scouted">Scouted</option><option value="gems">Gems</option></select></label>
    <label>Position<select id="filterPosition"><option value="all">All</option>${positions.map(p => `<option value="${p}">${p}</option>`).join("")}</select></label>
    <label>Priority<select id="filterPriority"><option value="all">All</option><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option></select></label>
    <label>Rating<select id="filterStars"><option value="all">All</option><option value="5">5</option><option value="4">4</option><option value="3">3</option></select></label>
    <input id="filterSearch" placeholder="Search prospects"></div></details>`;
  ["filterBucket","filterPosition","filterPriority","filterStars","filterSearch"].forEach(id => $(id).addEventListener(id === "filterSearch" ? "input" : "change", renderRecruitList));
  document.querySelectorAll(".recruit-chip").forEach(btn => btn.addEventListener("click", () => { $("filterBucket").value = btn.dataset.bucket; renderRecruitList(); }));
}

function prospectPoolRows() {
  const boardById = new Map((loadRecruitingWeekly().active_board || []).map(row => [row.prospect_id, row]));
  return (loadRecruitingClass().prospects || []).map((prospect, i) => {
    const board = boardById.get(prospect.prospect_id) || {};
    return { ...board, prospect, prospect_id: prospect.prospect_id, board_order: board.board_order || i + 1, name: cleanValue(board.name) || prospect.name, position: cleanValue(board.position) || prospect.position };
  });
}

function prospectSpecificText(...values) {
  const genericPatterns = [
    /active board target/i,
    /match to the full recruiting-class record requires confirmation/i,
    /review against roster need/i,
    /verified scouting profile/i
  ];
  return values.map(cleanValue).find(text => text && !genericPatterns.some(pattern => pattern.test(text))) || "";
}

function filteredRecruits(mode = "board") {
  const f = currentRecruitFilters();
  const activeIds = new Set((loadRecruitingWeekly().active_board || []).map(row => row.prospect_id));
  const priorityMap = new Map(priorityBoard().map(row => [row.position, row]));
  const rows = mode === "prospects" ? prospectPoolRows() : activeBoardRows();
  return rows.filter(row => {
    const p = row.prospect || row;
    if ((f.bucket === "active" || mode === "board") && mode !== "prospects" && !activeIds.has(row.prospect_id)) return false;
    if (f.bucket === "class" && !row.prospect) return false;
    if (f.bucket === "commits" && !/commit/i.test(cleanValue(row.status || p.status))) return false;
    if (f.bucket === "visits" && !cleanValue(row.visit_status || p.visit_status)) return false;
    if (f.bucket === "offered" && !/offer/i.test(cleanValue(row.offer_status || p.offer_status))) return false;
    if (f.bucket === "scouted" && !cleanValue(row.scouting_percentage || p.scouting_percentage)) return false;
    if (f.bucket === "gems" && !/gem/i.test(cleanValue(row.status || p.dealbreaker))) return false;
    if (f.position !== "all" && row.position !== f.position) return false;
    const pr = priorityMap.get(p.position);
    if (f.priority !== "all" && (!pr || pr.tier !== f.priority)) return false;
    if (f.stars !== "all" && String(p.stars || "") !== f.stars) return false;
    if (f.q && !`${row.name} ${row.position} ${p.hometown || ""}`.toLowerCase().includes(f.q)) return false;
    return true;
  });
}

function activeBoardRows() {
  const board = loadRecruitingWeekly().active_board || [];
  const classById = new Map((loadRecruitingClass().prospects || []).map(p => [p.prospect_id, p]));
  if (board.length) {
    return board.map((row, i) => {
      const linked = classById.get(row.prospect_id) || classById.get((row.linked_prospect_ids || [])[0]) || null;
      return {
        ...row,
        prospect: linked,
        board_order: row.board_order || i + 1,
        name: cleanValue(row.name) || cleanValue(linked && linked.name),
        position: cleanValue(row.position) || cleanValue(linked && linked.position)
      };
    }).sort((a, b) => Number(a.board_order || 999) - Number(b.board_order || 999));
  }
  return (loadRecruitingClass().prospects || []).map((prospect, i) => ({ ...prospect, prospect, board_order: i + 1 }));
}

function renderRecruitList(mode = window.ACTIVE_RECRUITING_VIEW || "board") {
  if (!$("recruitList")) return;
  window.ACTIVE_RECRUITING_VIEW = mode;
  if ($("recruitBoardTab")) $("recruitBoardTab").classList.toggle("active", mode === "board");
  if ($("prospectListTab")) $("prospectListTab").classList.toggle("active", mode === "prospects");
  const priorityMap = new Map(priorityBoard().map(row => [row.position, row]));
  const openId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("prospect") : "";
  const rows = filteredRecruits(mode);
  $("recruitList").innerHTML = `<h3>${mode === "prospects" ? "Prospect List" : "Recruiting Board"}</h3>${rows.slice(0, mode === "prospects" ? 80 : 35).map((row, i) => {
    const p = row.prospect || {};
    const a = p.analysis || {};
    const pr = priorityMap.get(row.position || p.position);
    const state = cleanValue(row.state || p.state || stateFromLocation(p.hometown));
    const rating = starRating(row.stars || p.stars);
    const open = openId && openId === row.prospect_id ? "open" : "";
    const reason = prospectSpecificText(row.description, a.recommended_action_reason);
    const aiSummary = prospectSpecificText(p.scouting_summary, a.summary);
    return `<details class="prospect-card compact-prospect" ${open}><summary><span class="rank-dot">${row.board_order || i + 1}</span><span><strong>${row.name}</strong><em>${cleanValue(row.position || p.position)}${rating ? ` | ${rating}` : ""}${state ? ` | ${state}` : ""}</em></span><b>${cleanValue(row.recommended_action || a.recommended_action || pr && pr.tier)}</b></summary>
      <div class="card-grid">${maybeRow("Board rank", row.board_order)}${maybeRow("Position", row.position || p.position)}${rating ? `<div class="data-row"><span>Rating</span><strong>${rating}</strong></div>` : ""}${maybeRow("State", state)}${maybeRow("Scouting", cleanValue(row.scouting_percentage || p.scouting_percentage) ? `${cleanValue(row.scouting_percentage || p.scouting_percentage)}%` : "")}${maybeRow("Interest", row.interest || p.interest)}${maybeRow("Offer", row.offer_status || p.offer_status)}${maybeRow("Visit", row.visit_status || p.visit_status)}${maybeRow("Status", row.status || p.status)}</div>
      ${maybeRow("National Rank", row.national_rank || p.national_rank)}${maybeRow("Interest", row.interest || p.interest)}${maybeRow("Offer", row.offer_status || p.offer_status)}${maybeRow("Visit", row.visit_status || p.visit_status)}${maybeRow("Commit", row.commit_status || p.commit_status || p.status)}${maybeRow("Gem/Bust", row.gem_bust || p.gem_bust || p.dealbreaker)}${maybeRow("Recommended Action", row.recommended_action || a.recommended_action)}${maybeRow("Reason", reason)}${maybeRow("AI Summary", aiSummary && aiSummary !== reason ? aiSummary : "")}${maybeRow("Recruiting value", a.recruiting_value)}${maybeRow("Projected role", a.projected_role)}${maybeRow("Strengths", a.strengths)}${maybeRow("Questions", a.questions_to_verify)}${maybeRow("Scheme fit", a.scheme_fit)}
    </details>`;
  }).join("")}`;
}

function renderActionPlan() {
  if (!$("actionPlanList")) return;
  const board = loadRecruitingWeekly().active_board || [];
  const classById = new Map((loadRecruitingClass().prospects || []).map(p => [p.prospect_id, p]));
  $("actionPlanList").innerHTML = `<div class="section-heading compact-heading"><p>Weekly Action Plan</p><strong>Top 3</strong></div><div class="action-strip">${board.slice(0, 3).map(row => {
    const prospect = classById.get(row.prospect_id) || {};
    const action = cleanValue(row.recommended_action || (prospect.analysis || {}).recommended_action);
    const reason = prospectSpecificText(row.description, (prospect.analysis || {}).recommended_action_reason, prospect.scouting_summary, (prospect.analysis || {}).summary);
    return `<details class="action-row-card compact-action"><summary><strong>${cleanValue(row.name || prospect.name)}</strong><span>${cleanValue(row.position || prospect.position)} | ${action}</span></summary>${maybeRow("Reason", reason)}${maybeRow("Position priority", (priorityBoard().find(p => p.position === (row.position || prospect.position)) || {}).tier)}${maybeRow("Resource recommendation", action)}${maybeRow("Scouting", prospect.scouting_percentage ? `${prospect.scouting_percentage}% scouted` : "")}</details>`;
  }).join("")}</div>${board.length > 3 ? `<details class="breakout compact-detail"><summary>View All Actions</summary>${board.slice(3).map(row => `<div class="data-row"><span>${cleanValue(row.position)}</span><strong>${cleanValue(row.name)} - ${cleanValue(row.recommended_action)}</strong></div>`).join("")}</details>` : ""}`;
}

function renderPackagePanel() {
  if (!$("more")) return;
  const gp = loadGameplanWeekly();
  const rw = loadRecruitingWeekly();
  $("more").innerHTML = `<div class="section-heading"><p>Rutgers Football</p><strong>More</strong></div>
    <section class="utility-section"><h3>Weekly Data</h3><div class="tool-grid">
      <label class="fileTool">Import Gameplan JSON<input id="importGameplanWeekly" type="file" accept="application/json,.json"></label><button id="exportGameplanBtn" type="button">Export Gameplan JSON</button>
      <label class="fileTool">Import Recruiting JSON<input id="importRecruitingWeekly" type="file" accept="application/json,.json"></label><button id="exportRecruitingBtn" type="button">Export Recruiting JSON</button>
    </div><div class="overview-grid">${maybeRow("Current package", gp.package_type)}${maybeRow("Current week", activeWeekLabel())}${maybeRow("Opponent", activeOpponentName())}${maybeRow("Last updated", gp.generated_utc)}${maybeRow("Validation result", "Loaded")}</div><div id="dataStatus" class="small"></div></section>
    ${moreGroup("History", ["Gameplan history", "Recruiting updates", "Opponent history", "Game results"])}
    ${moreGroup("Analytics", ["Team trends", "Player development", "Opponent tendencies", "Recruiting analytics"])}
    ${moreGroup("Settings & Tools", ["Gameplan scoring weights", "Recruiting scoring weights", "Display preferences", "Data validation", "Data management", "Clear cache", "Diagnostics", "Help", "About"])}`;
  $("exportGameplanBtn").addEventListener("click", () => exportJsonFile("gameplan_weekly.json", gp));
  $("exportRecruitingBtn").addEventListener("click", () => exportJsonFile("recruiting_weekly.json", rw));
  $("importGameplanWeekly").addEventListener("change", event => importEnginePackage(event.target.files[0], "gameplan"));
  $("importRecruitingWeekly").addEventListener("change", event => importEnginePackage(event.target.files[0], "recruiting"));
}

function moreGroup(title, items) {
  return `<details class="utility-section compact-detail"><summary>${title}</summary>${items.map(item => `<button class="utility-row" type="button"><span>${item}</span><em>&rsaquo;</em></button>`).join("")}</details>`;
}

function setStatus(message) {
  const node = $("dataStatus");
  if (node) node.textContent = message;
  const result = $("importResult");
  if (result) result.textContent = message;
}

function switchTab(tabName, shouldScroll = true) {
  document.querySelectorAll("[data-tab]").forEach(button => button.classList.toggle("active", button.dataset.tab === tabName));
  document.querySelectorAll(".tab").forEach(panel => panel.classList.toggle("active", panel.id === tabName));
  const panel = $(tabName);
  if (panel && shouldScroll) panel.scrollIntoView({ block: "start" });
}

function boot() {
  loadLocalWeeklyPackage();
  loadEnginePackages();
  window.GAME_HISTORY = loadHistory();
  validatePlaybook();
  validateWeeklyPlan(WEEKLY_PLAN);
  validateGameplanWeekly(weeklyGameplanData());
  if (typeof RECRUITING_WEEKLY !== "undefined") validateRecruitingWeekly(RECRUITING_WEEKLY);
  document.querySelectorAll("select").forEach(x => x.addEventListener("change", previewBest));
  if ($("search")) $("search").addEventListener("input", renderRanks);
  populateRankFilters();
  if ($("rankFamily")) $("rankFamily").addEventListener("change", renderRanks);
  if ($("rankFormation")) $("rankFormation").addEventListener("change", renderRanks);
  window.addEventListener("scroll", () => {
    const header = document.querySelector(".gameday-header");
    if (header) header.classList.toggle("compact-header", window.scrollY > 48);
  }, { passive: true });
  $("bestBtn").addEventListener("click", () => showBest(1));
  $("top3Btn").addEventListener("click", () => showBest(3));
  document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => switchTab(button.dataset.tab)));
  document.addEventListener("toggle", event => {
    const detail = event.target;
    if (!(detail instanceof HTMLDetailsElement) || !detail.open || !detail.matches(".compact-detail,.player-detail,.compact-prospect,.compact-match")) return;
    const scope = detail.closest(".tab") || document;
    scope.querySelectorAll("details.compact-detail[open],details.player-detail[open],details.compact-prospect[open],details.compact-match[open]").forEach(node => {
      if (node !== detail && node.parentElement === detail.parentElement) node.open = false;
    });
  }, true);
  renderStatic();
  previewBest();
  const params = new URLSearchParams(window.location.search);
  const requestedTab = params.get("tab");
  if (requestedTab && $(requestedTab)) switchTab(requestedTab, false);
  const requestedPersonnel = params.get("personnel");
  if (requestedTab === "personnel" && requestedPersonnel) renderPersonnelMatchups(requestedPersonnel);
  setStatus(`Loaded gameplan and recruiting packages for ${activeOpponentName()}`);
}

if (typeof document !== "undefined") boot();

if (typeof module !== "undefined") {
  module.exports = {
    conceptFamily,
    eligibility,
    playerFit,
    opponentMatchupModifier,
    recentCallPenalty,
    setupBonus,
    situationModifier,
    riskPenalty,
    scorePlay,
    buildRankings,
    diverseTop,
    displayValue,
    cap,
    sharedRosterBase,
    weeklyGameplanData,
    normalizePosition,
    priorityScore,
    priorityBoard,
    performanceNeed,
    cleanValue,
    formatLimited,
    premiumPlayerCard,
    matchupRow,
    renderPersonnelOverview,
    opponentPlayerCard,
    renderRosterCards,
    renderMatchups,
    MatchupCard,
    orderedMatchupRows,
    validMatchupRows,
    matchupPriority,
    matchupEdgeDisplay,
    explicitEdgeDifferential,
    evidenceRowsHtml
  };
}
