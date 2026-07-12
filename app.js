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

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "Not available";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not available";
  if (typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== "");
    return entries.length ? entries.map(([k, v]) => `${labelize(k)}: ${v}`).join("; ") : "Not available";
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
    const fallback = { id: "TEAM", name: "Not available", position: "Team", weeklyRole: "Best available personnel", priorityLabel: "Situational" };
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
    rationale: best.player.name === "Not available" ? "No verified primary player data available." : `${best.player.name} fits ${conceptFamily(play)} through weekly role and available attributes.`
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
  const secondaryName = personnel.secondaryPlayer ? personnel.secondaryPlayer.name : "Not available";
  return {
    ...play,
    eligible: true,
    conceptFamily: conceptFamily(play),
    primaryPlayer: personnel.primaryPlayer,
    secondaryPlayer: personnel.secondaryPlayer,
    primaryPlayerName: personnel.primaryPlayer.name,
    secondaryPlayerName: secondaryName,
    targetAssignment: targetAssignment(play, personnel.primaryPlayer),
    workloadRole: personnel.primaryPlayer.weeklyRole || "Not available",
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
  if (family === "inside run") return `${personnel.primaryPlayer.name} fits the interior plan and Purdue defensive tackles are reported mostly low-to-mid 70s.`;
  if (family === "quick pass" || family === "screen") return `${personnel.primaryPlayer.name} gives a faster answer against Q. Gillians edge pressure.`;
  if (family === "intermediate pass" || family === "RPO") return `${personnel.primaryPlayer.name} helps attack Purdue linebackers, reported mostly low 70s.`;
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
      successRate: "Not available",
      yardsPerPlay: "Not available",
      explosiveRate: "Not available",
      recentUse: loadRecentCalls().filter(row => row.playId === play.id).length ? "Used recently" : "Not available"
    };
  }
  const successRate = `${Math.round((rows.filter(row => row.result === "success").length / rows.length) * 100)}%`;
  const yardsRows = rows.filter(row => row.yards !== null && row.yards !== undefined && !Number.isNaN(Number(row.yards)));
  const yardsPerPlay = yardsRows.length ? (yardsRows.reduce((sum, row) => sum + Number(row.yards), 0) / yardsRows.length).toFixed(1) : "Not available";
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
    $("recommendation").innerHTML = `<div class="card-label">Best Call</div><h2>Not available</h2><p class="small">No eligible play for the current situation.</p>`;
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
      `<div class="subgrid">${(weekly.quick_tactical_summary || []).map(item => `<div class="mini-card">${displayValue(item)}</div>`).join("") || `<p class="small">Not available</p>`}</div>`;
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
  setText("seasonRecord", gameday.seasonRecord || profile.record || "Not available");
  setText("rutgersRank", gameday.rutgersRank || profile.rutgers_rank || "Not available");
  setText("offenseRank", gameday.offenseRank || profile.offense_rank || "Not available");
  setText("defenseRank", gameday.defenseRank || profile.defense_rank || "Not available");
  setText("momentumStatus", gameday.momentumStatus || profile.momentum_status || "Not available");
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
  return `<h3>${title}</h3>${rows && rows.length ? rows.map(renderer).join("") : `<p class="small">Not available</p>`}`;
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

function setStatus(message) {
  const node = $("dataStatus");
  if (node) node.textContent = message;
  const result = $("importResult");
  if (result) result.textContent = message;
}

function switchTab(tabName) {
  document.querySelectorAll("[data-tab]").forEach(button => button.classList.toggle("active", button.dataset.tab === tabName));
  document.querySelectorAll(".tab").forEach(panel => panel.classList.toggle("active", panel.id === tabName));
  const panel = $(tabName);
  if (panel) panel.scrollIntoView({ block: "start" });
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
  $("bestBtn").addEventListener("click", () => showBest(1));
  $("top3Btn").addEventListener("click", () => showBest(3));
  document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => switchTab(button.dataset.tab)));
  renderStatic();
  previewBest();
  setStatus(`Loaded gameplan and recruiting packages for ${WEEKLY_PLAN.opponent.name}`);
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
    performanceNeed
  };
}
