const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { adaptNormalizedCandidate } = require("./current_week_ui_adapter");
const { calculateLeaders, normalizeRecruiting } = require("./current_week_normalizer");

const players = Array.from({ length: 85 }, (_, index) => ({
  playerId: index + 1, displayName: index === 0 ? "Dylan Lonergan" : `Player ${index + 1}`,
  position: index === 0 ? "QB" : "WR", jerseyNumber: index + 1, schoolYear: "Senior",
  height: 74, weight: 210, hometown: "Piscataway", homeState: "New Jersey",
  archetype: "Test", developmentTrait: "normal", redshirtState: "Eligible", overall: 77,
  ratings: { OverallRating: 77 }, seasonStatistics: index === 0 ? { offense: { passYards: 931 } } : null,
  latestGameStatistics: null
}));
const normalized = {
  availability: { currentContext: { available: true }, roster: { available: true }, playerDetails: { available: true }, teamStatistics: { available: true }, leaders: { available: true }, lastGame: { available: true }, injuries: { available: true }, recruiting: { available: true }, opponent: { available: false, reason: "FCS placeholder" }, matchups: { available: false, reason: "Player-level matchups are unavailable for FCS placeholder teams." } },
  currentContext: { season: 2026, week: 4, rutgers: { record: "1-2", rank: 68, offense: 55, defense: 20 }, opponentLabel: "FCS East" },
  rutgersRoster: { count: 85, players }, rutgersPlayerStatistics: [{ playerId: 1, firstName: "Dylan", lastName: "Lonergan", offense: { passYards: 931 } }],
  rutgersTeamStatistics: { teamId: 78, stats: {} },
  rutgersTeamLeaders: { passing: { status: "available", leaders: [{ playerId: 1, displayName: "Dylan Lonergan", position: "QB", stat: "passYards", value: 931 }] }, interceptions: { status: "unavailable", leaders: [], unavailableReason: "Unavailable" }, kicking: { status: "unavailable", leaders: [], unavailableReason: "Unavailable" }, returns: { status: "unavailable", leaders: [], unavailableReason: "Unavailable" } },
  lastGame: { sourceGameId: 520, opponent: "USC", rutgersScore: 23, opponentScore: 41, finalScore: { rutgers: 23, opponent: 41 }, playerStatistics: {}, allRutgersPlayerStatistics: [], teamStatistics: { rutgers: {}, opponent: {} } },
  rutgersInjuries: { count: 12, records: Array.from({ length: 12 }, (_, index) => ({ playerId: index + 1, type: "Ankle", severity: "Minor" })) },
  recruiting: { available: true, label: "Rutgers Interest Pool", reason: null, rutgersInterestPool: { records: Array.from({ length: 229 }, (_, index) => ({ recruitId: index + 1, displayName: `Recruit ${index + 1}` })) }, rutgersActiveBoard: { status: "unavailable", records: [], reason: "Ownership unresolved" } },
  opponent: { name: "FCS East", dataAvailable: false, roster: [], leaders: [], injuries: [], depthChart: [], playerMatchups: [] }
};

const candidate = adaptNormalizedCandidate(normalized);
const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
assert.equal(candidate.generated, true);
assert.equal(candidate.current_context.week, 4);
assert.equal(candidate.roster.players.length, 85);
assert.equal(Object.keys(candidate.player_details).length, 85);
assert.equal(candidate.team_leaders.passing.leaders[0].value, 931);
for (const key of ["interceptions", "kicking", "returns"]) assert.equal(candidate.team_leaders[key].leaders.length, 0);
assert.equal(candidate.last_game.sourceGameId, 520);
assert.equal(candidate.injuries.count, 12);
assert.equal(candidate.recruiting.label, "Rutgers Interest Pool");
assert.equal(candidate.recruiting.interest_pool.records.length, 229);
assert.equal(candidate.recruiting.active_board.status, "unavailable");
assert.equal(candidate.opponent.dataAvailable, false);
assert.equal(candidate.matchup.available, false);
assert.deepEqual(
  { rank: candidate.roster.team.rank, offense: candidate.roster.team.offense, defense: candidate.roster.team.defense },
  { rank: 68, offense: 55, defense: 20 }
);
const opponentCandidate = adaptNormalizedCandidate({
  ...normalized,
  currentContext: { ...normalized.currentContext, opponentLabel: "Indiana" },
  opponent: {
    name: "Indiana",
    dataAvailable: true,
    roster: [{ id: 98, firstName: "Adedamola", lastName: "Ajani", position: "RT", schoolYear: "Sophomore", overall: 80, ratings: { StrengthRating: 86, AwarenessRating: 80, RunBlockRating: 83, PassBlockRating: 78, ImpactBlockingRating: 85, LeadBlockRating: 87 } }],
    playerStatistics: [{ playerId: 98, firstName: "Adedamola", lastName: "Ajani", teamId: 34, offense: { rushYards: 4 }, defense: {} }],
    leaders: [], injuries: [], depthChart: [], playerMatchups: []
  }
});
assert.deepEqual(
  {
    player_id: opponentCandidate.opponent.roster[0].player_id,
    name: opponentCandidate.opponent.roster[0].name,
    class_year: opponentCandidate.opponent.roster[0].class_year,
    attributes: opponentCandidate.opponent.roster[0].attributes
  },
  {
    player_id: "98",
    name: "Adedamola Ajani",
    class_year: "Sophomore",
    attributes: { strength: 86, awareness: 80, run_block: 83, pass_block: 78, impact_block: 85, lead_block: 87 }
  }
);
assert.equal(opponentCandidate.opponent.seasonStatistics.rushing[0].player_id, "98");
const leaderPlayers = [
  { playerId: 15196, displayName: "Moses Walker", position: "MLB", seasonStatistics: { defense: { tackles: 19 } } },
  { playerId: 1633, displayName: "J'Dan Burnett", position: "RE", seasonStatistics: { defense: { sacks: 1 } } },
  { playerId: 2714, displayName: "Malachi Davis", position: "LE", seasonStatistics: { defense: { sacks: 1 } } },
  { playerId: 8586, displayName: "Rondarius Porter", position: "DT", seasonStatistics: { defense: { sacks: 1 } } }
];
const calculated = calculateLeaders(leaderPlayers);
assert.deepEqual(calculated.tackles.leaders.map(row => [row.playerId, row.value]), [[15196, 19]]);
assert.deepEqual(calculated.sacks.leaders.map(row => row.playerId), [1633, 2714, 8586]);
const unavailableRecruiting = normalizeRecruiting({});
const withoutRecruiting = adaptNormalizedCandidate({ ...normalized, availability: { ...normalized.availability, recruiting: { available: false, reason: unavailableRecruiting.reason } }, recruiting: unavailableRecruiting });
assert.equal(withoutRecruiting.generated, true);
assert.equal(withoutRecruiting.roster.count, 85);
assert.equal(withoutRecruiting.team_leaders.passing.leaders[0].value, 931);
assert.equal(withoutRecruiting.last_game.sourceGameId, 520);
assert.equal(withoutRecruiting.injuries.count, 12);
assert.equal(withoutRecruiting.recruiting.available, false);
assert.equal(withoutRecruiting.recruiting.label, "Recruiting data unavailable");
assert.equal(withoutRecruiting.recruiting.interest_pool.records.length, 0);
assert.equal(withoutRecruiting.recruiting.active_board.records.length, 0);
assert(appSource.includes("currentWeekPreview()"), "legacy fallback seam missing");
assert(!appSource.includes("CURRENT_WEEK_UI_PREVIEW ="), "generated data must not be embedded in the consumer source");
console.log("PASS current-week UI adapter compatibility and FCS-safe fallbacks");
