const $ = id => document.getElementById(id);
const HISTORY_KEY = "rutgers_game_history";
const WEEKLY_KEY = "rutgers_weekly_package";
const RECENT_CALLS_KEY = "rutgers_recent_calls";
const REQUIRED_SITUATIONS = ["short", "medium", "long", "red_zone", "goal_line", "two_minute", "normal", "must_score"];
const state = { ranked: [] };

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

function situationContext() {
  const down = $("down").value;
  const dist = $("distance").value;
  const zone = $("zone").value;
  const gameState = $("state").value;
  let key = dist;
  if (zone === "goal_line" || zone === "red_zone") key = zone;
  if (zone === "fringe") key = "red_zone";
  if (zone === "backed_up") key = "normal";
  if (gameState === "two_minute" || gameState === "must_score") key = gameState;
  if (gameState === "protect_lead") key = "short";
  return { down, dist, zone, gameState, key };
}

function situationKey() {
  return situationContext().key;
}

function playMap() {
  return new Map(RUTGERS_PLAYBOOK.map(play => [play.id, play]));
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
  for (const key of ["familyModifiers", "riskRules", "traits", "usage", "warnings"]) {
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
    for (const sit of play.situations || []) covered.add(sit);
  }
  const missing = REQUIRED_SITUATIONS.filter(sit => !covered.has(sit));
  if (missing.length) throw new Error(`Missing situation coverage: ${missing.join(", ")}`);
}

function conceptFamily(play) {
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
  return family.replaceAll("_", " ");
}

function isLowRisk(play, risk) {
  return risk === "low" || ["inside run", "outside run", "quick pass", "screen", "RPO"].includes(conceptFamily(play));
}

function historyModifier(id, history = window.GAME_HISTORY || []) {
  const rows = history.filter(row => row.playId === id).slice(-8);
  let modifier = 0;
  for (const row of rows) {
    if (row.result === "success") modifier += 1.5;
    if (row.result === "failure") modifier -= 1.5;
    if (Number(row.yards) >= 6) modifier += 0.5;
    if (Number(row.yards) <= -1) modifier -= 0.5;
    if (row.sack) modifier -= 1;
    if (row.turnover) modifier -= 2;
    if (row.explosive) modifier += 1.5;
    if (row.thirdDownConversion) modifier += 1;
    if (row.redZoneTouchdown) modifier += 1.5;
  }
  return Math.max(-6, Math.min(6, modifier));
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
  return { value: penalty, reasons };
}

function setupBonus(play, history = window.GAME_HISTORY || []) {
  const playById = playMap();
  const lastFive = history.slice(-5);
  const family = conceptFamily(play);
  let bonus = 0;
  const reasons = [];
  const successfulInsideRuns = lastFive.filter(row => row.result === "success" && conceptFamily(playById.get(row.playId) || {}) === "inside run").length;
  if (successfulInsideRuns >= 2 && family === "play action") {
    bonus += 8;
    reasons.push("two successful inside runs -> play action +8");
  }
  if (successfulInsideRuns >= 2 && family === "RPO") {
    bonus += 6;
    reasons.push("two successful inside runs -> RPO +6");
  }
  if (lastFive.some(row => row.result === "success" && conceptFamily(playById.get(row.playId) || {}) === "screen")) {
    if (family === "inside run") {
      bonus += 3;
      reasons.push("successful screen -> inside run +3");
    }
    if (family === "intermediate pass") {
      bonus += 3;
      reasons.push("successful screen -> intermediate pass +3");
    }
  }
  if (lastFive.some(row => row.result === "success" && conceptFamily(playById.get(row.playId) || {}) === "quick pass") && family === "deep pass") {
    bonus += 4;
    reasons.push("successful quick pass -> deep shot +4");
  }
  if (lastFive.some(row => row.sack || (row.result === "failure" && conceptFamily(playById.get(row.playId) || {}) === "deep pass"))) {
    if (family === "deep pass") {
      bonus -= 8;
      reasons.push("failed deep pass or sack -> deep pass -8");
    }
    if (family === "quick pass") {
      bonus += 5;
      reasons.push("failed deep pass or sack -> quick pass +5");
    }
    if (family === "screen") {
      bonus += 5;
      reasons.push("failed deep pass or sack -> screen +5");
    }
  }
  return { value: bonus, reasons };
}

function situationModifier(play, context) {
  const family = conceptFamily(play);
  const name = `${play.name} ${play.formation}`.toLowerCase();
  let modifier = 0;
  const reasons = [];
  if (play.situations.includes(context.key)) {
    modifier += 5;
    reasons.push(`${context.key} fit +5`);
  }
  if (context.key === "red_zone" && play.situations.includes("red_zone")) {
    modifier += 4;
    reasons.push("red zone fit +4");
  }
  if (context.key === "goal_line" && play.situations.includes("goal_line")) {
    modifier += 6;
    reasons.push("goal line fit +6");
  }
  if (context.down === "1") {
    if (["inside run", "quick pass", "RPO", "play action", "screen"].includes(family)) {
      modifier += 3;
      reasons.push("1st down balanced call +3");
    }
    if (family === "deep pass") {
      modifier -= 4;
      reasons.push("1st down avoids raw-score deep lean -4");
    }
  }
  if (context.down === "2" && context.dist === "short" && ["deep pass", "play action", "intermediate pass"].includes(family)) {
    modifier += 5;
    reasons.push("2nd and short controlled shot +5");
  }
  if (context.down === "3" && context.dist === "medium" && ["quick pass", "intermediate pass", "RPO"].includes(family)) {
    modifier += 7;
    reasons.push("3rd and medium quick/intermediate/RPO +7");
  }
  if (context.down === "3" && context.key === "long" && family === "inside run") {
    modifier -= 5;
    reasons.push("3rd and long inside run -5");
  }
  if (context.zone === "red_zone" || context.zone === "fringe") {
    if (["RPO", "play action", "inside run"].includes(family)) {
      modifier += 4;
      reasons.push("red zone RPO/boot/power lean +4");
    }
    if (name.includes("boot") || name.includes("mtn") || name.includes("power")) {
      modifier += 3;
      reasons.push("red zone boot/motion/power tag +3");
    }
  }
  if (context.gameState === "protect_lead") {
    if (["inside run", "outside run", "quick pass", "screen", "RPO"].includes(family)) {
      modifier += 5;
      reasons.push("protect lead low-risk run/quick +5");
    }
    if (family === "deep pass") {
      modifier -= 8;
      reasons.push("protect lead deep pass -8");
    }
  }
  if (context.gameState === "must_score") {
    if (["deep pass", "intermediate pass", "play action"].includes(family)) {
      modifier += 4;
      reasons.push("must score expands attack +4");
    }
    if (family === "inside run") {
      modifier -= 2;
      reasons.push("must score reduces conservative run -2");
    }
  }
  return { value: modifier, reasons };
}

function riskPenalty(play, risk, context) {
  let penalty = 0;
  const reasons = [];
  if (risk === "high") {
    penalty -= context.gameState === "must_score" ? 1 : 3;
    reasons.push(context.gameState === "must_score" ? "high risk, must score -1" : "high risk -3");
  }
  if (context.gameState === "protect_lead" && !isLowRisk(play, risk)) {
    penalty -= 4;
    reasons.push("protect lead non-low-risk -4");
  }
  return { value: penalty, reasons };
}

function scorePlay(play, context = situationContext(), history = window.GAME_HISTORY || [], recentCalls = loadRecentCalls()) {
  const risk = WEEKLY_PLAN.riskRules[play.family] || "medium";
  const baseScore = play.baseScore;
  const matchupModifier = WEEKLY_PLAN.familyModifiers[play.family] || 0;
  const historyAdjustment = historyModifier(play.id, history);
  const situation = situationModifier(play, context);
  const recent = recentCallPenalty(play, recentCalls);
  const setup = setupBonus(play, history);
  const riskResult = riskPenalty(play, risk, context);
  const finalScore = Math.round((baseScore + matchupModifier + historyAdjustment + situation.value + recent.value + setup.value + riskResult.value) * 10) / 10;
  return {
    ...play,
    conceptFamily: conceptFamily(play),
    risk,
    baseScore,
    matchupModifier,
    historyAdjustment,
    situationModifier: situation.value,
    situationReasons: situation.reasons,
    recentCallPenalty: recent.value,
    recentCallReasons: recent.reasons,
    setupBonus: setup.value,
    setupReasons: setup.reasons,
    riskPenalty: riskResult.value,
    riskReasons: riskResult.reasons,
    score: finalScore
  };
}

function buildRankings(context = situationContext(), history = window.GAME_HISTORY || [], recentCalls = loadRecentCalls()) {
  return RUTGERS_PLAYBOOK.map(play => scorePlay(play, context, history, recentCalls))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function diverseTop(ranked, count = 3) {
  if (count === 1) return ranked.slice(0, 1);
  const availableFamilies = new Set(ranked.map(play => play.conceptFamily));
  if (availableFamilies.size < 3) return ranked.slice(0, count);
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
  const q = $("search").value.toLowerCase();
  const list = state.ranked.filter(play => !q || play.name.toLowerCase().includes(q) || play.formation.toLowerCase().includes(q));
  $("rankList").innerHTML = list.map((play, i) => callCard(play, i + 1)).join("");
}

function scoreBreakdown(play) {
  return `<div class="breakdown">
    <span>Base ${play.baseScore}</span>
    <span>Matchup ${signed(play.matchupModifier)}</span>
    <span>Situation ${signed(play.situationModifier)}</span>
    <span>Recent ${signed(play.recentCallPenalty)}</span>
    <span>Setup ${signed(play.setupBonus)}</span>
    <span>Risk ${signed(play.riskPenalty)}</span>
    <strong>Final ${play.score}</strong>
  </div>`;
}

function explanationText(play) {
  const parts = [
    ...play.situationReasons,
    ...play.recentCallReasons,
    ...play.setupReasons,
    ...play.riskReasons
  ];
  return parts.length ? parts.join("; ") : "No extra adjustment beyond base, matchup and history.";
}

function signed(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function callCard(play, rankNumber) {
  return `<div class="call">
    <div class="rank">${rankNumber}</div>
    <div>
      <h3>${play.name}</h3>
      <div class="small">${play.formation} - ${play.conceptFamily}</div>
      <div class="small">Weekly fit: ${play.score}</div>
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
  for (const play of plays) {
    rows.push({ timestamp: now, opponent: WEEKLY_PLAN.opponent.name, playId: play.id, family: play.conceptFamily });
  }
  saveRecentCalls(rows);
}

function showBest(count = 1) {
  rank();
  const picks = count === 1 ? state.ranked.slice(0, 1) : diverseTop(state.ranked, count);
  $("recommendation").innerHTML = picks.map((play, i) => `<div class="${i ? "altPick" : ""}">
    <div class="meta">${i === 0 ? "BEST CALL" : `ALTERNATIVE ${i + 1}`}</div>
    <h2>${play.name}</h2>
    <div class="meta">${play.formation} - ${play.conceptFamily}</div>
    <div class="score">${play.score}</div>
    <span class="risk ${play.risk}">${play.risk} risk</span>
    ${scoreBreakdown(play)}
    <div class="small">${explanationText(play)}</div>
  </div>`).join("");
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
  if (!playMap().has(playId)) {
    setStatus(`Rejected unknown play ID: ${playId}`);
    return;
  }
  const rows = loadHistory();
  rows.push({
    timestamp: new Date().toISOString(),
    opponent: WEEKLY_PLAN.opponent.name,
    playId,
    result,
    ...readLogControls(playId)
  });
  saveHistory(rows);
  setStatus(`Saved ${result} for ${playMap().get(playId).name}`);
  rank();
}

function renderStatic() {
  $("matchupLine").textContent = `${RUTGERS_TEAM.team} vs ${WEEKLY_PLAN.opponent.name} - ${WEEKLY_PLAN.opponent.record}`;
  $("scriptList").innerHTML = WEEKLY_PLAN.openingScript.map((id, i) => {
    const play = playMap().get(id);
    return `<div class="call"><div class="rank">${i + 1}</div><div><h3>${play ? play.name : id}</h3><div class="small">${play ? play.formation : "INVALID PLAY ID"}</div></div></div>`;
  }).join("");
  $("traitList").innerHTML = WEEKLY_PLAN.traits.map(t => `<div class="trait"><h3>${t.title}</h3><div class="small">${t.evidence}</div><p>${t.response}</p></div>`).join("") + `<h3>Warnings</h3>` + WEEKLY_PLAN.warnings.map(x => `<p>- ${x}</p>`).join("");
  $("usageList").innerHTML = WEEKLY_PLAN.usage.map(u => `<div class="usage"><h3>${u.player}</h3><p>${u.plan}</p></div>`).join("");
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
      showBest(1);
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

function boot() {
  loadLocalWeeklyPackage();
  window.GAME_HISTORY = loadHistory();
  validatePlaybook();
  validateWeeklyPlan(WEEKLY_PLAN);
  document.querySelectorAll("select").forEach(x => x.addEventListener("change", () => showBest(1)));
  $("search").addEventListener("input", renderRanks);
  $("bestBtn").addEventListener("click", () => showBest(1));
  $("top3Btn").addEventListener("click", () => showBest(3));
  $("exportBtn").addEventListener("click", exportWeeklyJson);
  $("importWeekly").addEventListener("change", event => importWeeklyJson(event.target.files[0]));
  document.querySelectorAll(".tabs button").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".tabs button,.tab").forEach(x => x.classList.remove("active"));
    button.classList.add("active");
    $(button.dataset.tab).classList.add("active");
  }));
  renderStatic();
  rank();
  setStatus(`Loaded weekly package: ${WEEKLY_PLAN.opponent.name}`);
}

if (typeof document !== "undefined") boot();

if (typeof module !== "undefined") {
  module.exports = {
    conceptFamily,
    historyModifier,
    recentCallPenalty,
    setupBonus,
    situationModifier,
    riskPenalty,
    scorePlay,
    buildRankings,
    diverseTop
  };
}
