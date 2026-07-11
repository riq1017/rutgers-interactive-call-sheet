const $ = id => document.getElementById(id);
const HISTORY_KEY = "rutgers_game_history";
const WEEKLY_KEY = "rutgers_weekly_package";
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

function scorePlay(play, context = situationContext(), history = window.GAME_HISTORY || [], recentCalls = loadRecentCalls()) {
  const check = eligibility(play, context);
  if (!check.eligible) return { ...play, eligible: false, exclusionReasons: check.reasons };
  const personnel = playerFit(play);
  const matchup = opponentMatchupModifier(play);
  const setup = setupBonus(play, history);
  const recent = recentCallPenalty(play, recentCalls);
  const situation = situationModifier(play, context, history);
  const risk = riskPenalty(play, context, history);
  const finalScore = clampScore(play.baseScore + personnel.modifier + matchup + personnel.seasonModifier + personnel.recentModifier + situation.value + setup.value + recent.value + risk.value);
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
  const list = state.ranked.filter(play => !q || play.name.toLowerCase().includes(q) || play.formation.toLowerCase().includes(q) || play.primaryPlayerName.toLowerCase().includes(q));
  $("rankList").innerHTML = list.map((play, i) => callCard(play, i + 1)).join("");
}

function scoreBreakdown(play) {
  return `<div class="breakdown">
    <span>Base score ${play.baseScore}</span>
    <span>Matchup modifier ${signed(play.matchupModifier)}</span>
    <span>Situation modifier ${signed(play.situationModifier)}</span>
    <span>Personnel fit ${signed(play.personnelFit)}</span>
    <span>Season production ${signed(play.seasonModifier)}</span>
    <span>Recent form ${signed(play.recentFormModifier)}</span>
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
    <div class="play-diagram">Play diagram: Not available</div>
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
      <button type="button" onclick="switchTab('scouting')">Scouting Report</button>
    </div>
  </article>`;
}

function renderRecommendations(picks) {
  if (!$("recommendation")) return;
  if (!picks.length) {
    $("recommendation").innerHTML = `<div class="card-label">Best Call</div><h2>Not available</h2><p class="small">No eligible play for the current situation.</p>`;
    return;
  }
  $("recommendation").innerHTML = picks.map((play, i) => bestCallCard(play, i + 1, i === 0 ? "Best Call" : `Top ${i + 1}`)).join("");
}

function previewBest() {
  state.ranked = buildRankings();
  renderRecommendations(state.ranked.slice(0, 1));
  renderRanks();
}

function showBest(count = 1) {
  rank();
  const picks = count === 1 ? state.ranked.slice(0, 1) : diverseTop(state.ranked, count);
  renderRecommendations(picks);
  markCalled(picks);
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
  if ($("traitList")) $("traitList").innerHTML = WEEKLY_PLAN.traits.map(t => `<div class="trait"><h3>${t.title}</h3><div class="small">${t.evidence}</div><p>${t.response}</p></div>`).join("") + `<h3>Warnings</h3>` + WEEKLY_PLAN.warnings.map(x => `<p>- ${x}</p>`).join("");
  if ($("moreList")) $("moreList").innerHTML = `<div class="trait"><h3>Package</h3><p><strong>Build:</strong> ${displayValue(WEEKLY_PLAN.buildId)}</p><p><strong>Opponent:</strong> ${displayValue(WEEKLY_PLAN.opponent.name)}</p><p><strong>Record:</strong> ${displayValue(WEEKLY_PLAN.opponent.record)}</p></div>`;
  renderUsage();
}

function renderGamedayHeader() {
  const gameday = WEEKLY_PLAN.gameday || {};
  const opponent = WEEKLY_PLAN.opponent || {};
  setText("programLabel", "Rutgers Football");
  setText("appTitle", gameday.title || "Gameday Gameplan");
  setText("weekOpponent", `${displayValue(gameday.currentWeek || opponent.week)} - ${displayValue(RUTGERS_TEAM.team)} vs ${displayValue(opponent.name)}`);
  setText("seasonRecord", gameday.seasonRecord || "Not available");
  setText("rutgersRank", gameday.rutgersRank || "Not available");
  setText("offenseRank", gameday.offenseRank || "Not available");
  setText("defenseRank", gameday.defenseRank || "Not available");
  setText("momentumStatus", gameday.momentumStatus || "Not available");
  setText("packageName", `${displayValue(opponent.name)} package`);
  setText("packageUpdated", gameday.lastUpdated || "Not available");
  setText("packageOptions", gameday.packageOptions || "Not available");
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

function exportWeeklyJson() {
  const blob = new Blob([JSON.stringify(WEEKLY_PLAN, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${WEEKLY_PLAN.buildId || "rutgers-weekly-package"}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  setStatus("Weekly JSON exported.");
}

function importWeeklyJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      validateWeeklyPlan(parsed);
      window.WEEKLY_PLAN = parsed;
      localStorage.setItem(WEEKLY_KEY, JSON.stringify(parsed));
      renderStatic();
      previewBest();
      setStatus(`Imported weekly package: ${parsed.opponent.name}`);
    } catch (err) {
      setStatus(`Import rejected: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

function setStatus(message) {
  const node = $("dataStatus");
  if (node) node.textContent = message;
}

function switchTab(tabName) {
  document.querySelectorAll("[data-tab]").forEach(button => button.classList.toggle("active", button.dataset.tab === tabName));
  document.querySelectorAll(".tab").forEach(panel => panel.classList.toggle("active", panel.id === tabName));
  const panel = $(tabName);
  if (panel) panel.scrollIntoView({ block: "start" });
}

function boot() {
  loadLocalWeeklyPackage();
  window.GAME_HISTORY = loadHistory();
  validatePlaybook();
  validateWeeklyPlan(WEEKLY_PLAN);
  document.querySelectorAll("select").forEach(x => x.addEventListener("change", previewBest));
  if ($("search")) $("search").addEventListener("input", renderRanks);
  $("bestBtn").addEventListener("click", () => showBest(1));
  $("top3Btn").addEventListener("click", () => showBest(3));
  $("exportBtn").addEventListener("click", exportWeeklyJson);
  $("importWeekly").addEventListener("change", event => importWeeklyJson(event.target.files[0]));
  document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => switchTab(button.dataset.tab)));
  renderStatic();
  previewBest();
  setStatus(`Loaded weekly package: ${WEEKLY_PLAN.opponent.name}`);
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
    cap
  };
}
