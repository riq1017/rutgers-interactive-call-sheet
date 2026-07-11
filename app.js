const $ = id => document.getElementById(id);
const HISTORY_KEY = "rutgers_game_history";
const WEEKLY_KEY = "rutgers_weekly_package";
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

function situationKey() {
  const dist = $("distance").value;
  const zone = $("zone").value;
  const gs = $("state").value;
  if (zone === "goal_line" || zone === "red_zone") return zone;
  if (zone === "fringe") return "red_zone";
  if (zone === "backed_up") return "normal";
  if (gs === "two_minute" || gs === "must_score") return gs;
  if (gs === "protect_lead") return "short";
  return dist;
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

function historyModifier(id) {
  const rows = (window.GAME_HISTORY || []).filter(row => row.playId === id).slice(-8);
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

function rank() {
  const key = situationKey();
  state.ranked = RUTGERS_PLAYBOOK.map(play => {
    let score = play.baseScore + (WEEKLY_PLAN.familyModifiers[play.family] || 0) + historyModifier(play.id);
    if (play.situations.includes(key)) score += 5;
    if (key === "red_zone" && play.situations.includes("red_zone")) score += 4;
    if (key === "goal_line" && play.situations.includes("goal_line")) score += 6;
    if ($("down").value === "3" && key === "long" && play.family === "run_inside") score -= 5;
    const risk = WEEKLY_PLAN.riskRules[play.family] || "medium";
    if (risk === "high") score -= 3;
    return { ...play, score: Math.round(score * 10) / 10, risk };
  }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  renderRanks();
}

function renderRanks() {
  const q = $("search").value.toLowerCase();
  const list = state.ranked.filter(play => !q || play.name.toLowerCase().includes(q) || play.formation.toLowerCase().includes(q));
  $("rankList").innerHTML = list.map((play, i) => callCard(play, i + 1)).join("");
}

function callCard(play, rankNumber) {
  const family = play.family.replaceAll("_", " ");
  return `<div class="call">
    <div class="rank">${rankNumber}</div>
    <div>
      <h3>${play.name}</h3>
      <div class="small">${play.formation} - ${family}</div>
      <div class="small">Weekly fit: ${play.score}</div>
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

function showBest(count = 1) {
  rank();
  const picks = state.ranked.slice(0, count);
  $("recommendation").innerHTML = picks.map((play, i) => `<div class="${i ? "altPick" : ""}">
    <div class="meta">${i === 0 ? "BEST CALL" : `ALTERNATIVE ${i + 1}`}</div>
    <h2>${play.name}</h2>
    <div class="meta">${play.formation} - ${play.family.replaceAll("_", " ")}</div>
    <div class="score">${play.score}</div>
    <span class="risk ${play.risk}">${play.risk} risk</span>
  </div>`).join("");
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
  showBest(1);
  setStatus(`Loaded weekly package: ${WEEKLY_PLAN.opponent.name}`);
}

boot();
