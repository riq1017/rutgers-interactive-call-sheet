"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  normalizedRecruitingCollection,
  normalizedRecruitingHtml,
  normalizedRecruitingState,
  normalizedRecruitingUnavailableHtml,
  validateNormalizedRecruitingPayload,
  nationalRecruitingQuery,
  nationalRecruitingDatabase,
  NATIONAL_RECRUIT_PAGE_SIZE,
  recruitPositionGroup,
  recruitMatchesPositionGroup,
  recruitRatingVisibility,
  recruitOverallDisplay,
  recruitCompactRow,
  myBoardRecruitingList,
  normalizedRecruitById,
  normalizedRecruitDetailHtml
} = require("../app");

function entry(overrides = {}) {
  return {
    recruitId: 9,
    fullName: "Sam Scarlet",
    position: "QB",
    stars: "FOUR_STAR",
    overall: 82,
    archetype: "Field General",
    hometown: "Piscataway",
    homeState: "New Jersey",
    boardSlot: 4,
    boardOrder: 0,
    activeBoardMembership: true,
    pursuitOwnerTeamId: 78,
    allocatedRecruitingHours: null,
    scholarshipStatus: null,
    offerOwnerTeamId: null,
    pitchOwnerTeamId: 78,
    activePitches: null,
    visitOwnerTeamId: 78,
    scheduledVisit: null,
    prospectInfluenceTotal: null,
    prospectInfluenceDelta: null,
    committedTeamId: null,
    signedTeamId: null,
    commitmentOwnershipStatus: "unresolved",
    signingOwnershipStatus: "unresolved",
    ...overrides
  };
}

function payload(board = [], overrides = {}) {
  const offers = board.filter(row => row.offerOwnerTeamId === 78);
  const visits = board.filter(row => row.scheduledVisit);
  const pitches = board.filter(row => Array.isArray(row.activePitches) && row.activePitches.length);
  return {
    schemaVersion: "cfb27_recruiting_normalized_v1",
    recruitingSummary: {
      teamId: 78, teamName: "Rutgers", boardCount: board.length,
      offerCount: offers.length, assignedHours: 0, processedHours: 0,
      totalHours: 350, pitchCount: pitches.length, visitCount: visits.length
    },
    recruitingBoard: board,
    recruitingOffers: offers,
    recruitingVisits: visits,
    recruitingPitches: pitches,
    nationalRecruiting: board.map(row => ({
      recruitId: row.recruitId, fullName: row.fullName, position: row.position,
      stars: row.stars, nationalRank: row.nationalRank ?? row.recruitId,
      positionRank: row.positionRank ?? row.recruitId, stateRank: row.stateRank ?? row.recruitId,
      homeState: row.homeState, rutgersTargeted: true, rutgersBoardOrder: row.boardOrder
    })),
    validation: {
      duplicateMembershipCount: 0, unresolvedReferenceCount: 0, boardOrderErrorCount: 0,
      commitmentOwnership: "unresolved", signingOwnership: "unresolved"
    },
    ...overrides
  };
}

test("renders Week 5 Rutgers summary and explicit empty board", () => {
  const html = normalizedRecruitingHtml(payload());
  for (const value of ["Weekly Hours", ">350<", "Assigned Hours", "Processed Hours", "Board Count", "Offers", "Active Pitches", "Visits"]) assert.match(html, new RegExp(value));
  assert.match(html, /No recruits are currently on the Rutgers recruiting board\./);
  assert.doesNotMatch(html, /data-recruit-id=/);
});

test("fails closed for absent and invalid payloads", () => {
  const absent = normalizedRecruitingState({ ACTIVE_PACKAGE_ARTIFACTS: {} });
  assert.equal(absent.ok, false);
  assert.match(normalizedRecruitingUnavailableHtml(absent.reason), /Recruiting data unavailable/);
  assert.equal(validateNormalizedRecruitingPayload({ schemaVersion: "wrong" }).ok, false);
  assert.equal(validateNormalizedRecruitingPayload(payload([], { recruitingBoard: {} })).ok, false);
});

test("accepts the prior v1 national rows and derives board membership without mutation", () => {
  const data = payload([entry()]);
  delete data.nationalRecruiting[0].rutgersTargeted;
  delete data.nationalRecruiting[0].rutgersBoardOrder;
  const before = JSON.stringify(data);
  assert.equal(validateNormalizedRecruitingPayload(data).ok, true);
  assert.equal(nationalRecruitingQuery(data, { targeted: "rutgers" }).rows[0].rutgersTargeted, true);
  assert.equal(JSON.stringify(data), before);
});

test("renders populated board fields in stable stored order", () => {
  const board = [entry(), entry({ recruitId: 10, fullName: "Taylor Knight", boardOrder: 1, boardSlot: 11 })];
  const html = normalizedRecruitingHtml(payload(board));
  assert.ok(html.indexOf("Sam Scarlet") < html.indexOf("Taylor Knight"));
  for (const value of ["Slot 4", "My Board", "Scouted: Unresolved"]) assert.match(html, new RegExp(value));
  const detail = normalizedRecruitDetailHtml(payload(board), 9, "my");
  for (const value of ["Field General", "Piscataway", "Commitment ownership", "Signing ownership"]) assert.match(detail, new RegExp(value));
});

test("renders null fields as N/A without inventing commitment state", () => {
  const html = normalizedRecruitDetailHtml(payload([entry()]), 9, "my");
  assert.match(html, /N\/A/);
  assert.doesNotMatch(html, /\bUncommitted\b/i);
  assert.doesNotMatch(html, /Committed:/i);
});

test("uses only normalized offer, visit, and pitch collections", () => {
  const active = entry({
    offerOwnerTeamId: 78,
    scholarshipStatus: "Offered",
    scheduledVisit: { week: 8, weekType: "RegularSeason", activity: "AttendGame" },
    activePitches: [{ pitch: "Prestigious", intensity: "HardSell" }]
  });
  const data = payload([active, entry({ recruitId: 10, fullName: "No Activity", boardOrder: 1 })]);
  assert.match(normalizedRecruitingCollection(data, "offers"), /Sam Scarlet/);
  assert.doesNotMatch(normalizedRecruitingCollection(data, "offers"), /No Activity/);
  assert.match(normalizedRecruitingCollection(data, "visits"), /RegularSeason · Week 8 · AttendGame/);
  assert.match(normalizedRecruitingCollection(data, "pitches"), /Prestigious \(HardSell\)/);
});

test("rejects cross-team, inferred, duplicate, and unordered ownership", () => {
  assert.equal(validateNormalizedRecruitingPayload(payload([entry({ pursuitOwnerTeamId: 5 })])).ok, false);
  assert.equal(validateNormalizedRecruitingPayload(payload([entry({ committedTeamId: 78 })])).ok, false);
  assert.equal(validateNormalizedRecruitingPayload(payload([entry(), entry({ boardOrder: 1 })])).ok, false);
  assert.equal(validateNormalizedRecruitingPayload(payload([entry({ boardOrder: 2 }), entry({ recruitId: 10, boardOrder: 1 })])).ok, false);
});

test("does not mutate normalized input", () => {
  const data = payload([entry()]);
  const before = JSON.stringify(data);
  normalizedRecruitingHtml(data);
  normalizedRecruitingCollection(data, "board");
  assert.equal(JSON.stringify(data), before);
});

test("includes responsive mobile layout rules", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  const mobile = css.indexOf("@media(max-width:420px){", css.indexOf(".normalized-recruiting-view"));
  assert.ok(mobile >= 0);
  assert.ok(css.indexOf(".normalized-recruiting-summary{grid-template-columns:repeat(2", mobile) > mobile);
  assert.ok(css.indexOf(".normalized-recruit-activity{grid-template-columns:1fr", mobile) > mobile);
  assert.ok(css.indexOf(".national-recruiting-controls{grid-template-columns:repeat(2", mobile) > mobile);
});

test("queries the national class without mutating source or board order", () => {
  const board = [entry({ recruitId: 824, fullName: "Michael Jackson", boardOrder: 0, allocatedRecruitingHours: 50 })];
  const data = payload(board);
  data.nationalRecruiting.push(
    { recruitId: 1, fullName: "Aaron Alpha", position: "HB", stars: "THREE_STAR", nationalRank: 2, positionRank: 1, stateRank: 1, homeState: "Texas", rutgersTargeted: false, rutgersBoardOrder: null },
    { recruitId: 2, fullName: "Zane Zebra", position: "QB", stars: "FIVE_STAR", nationalRank: 1, positionRank: 1, stateRank: null, homeState: null, rutgersTargeted: false, rutgersBoardOrder: null }
  );
  const before = JSON.stringify(data);
  assert.deepEqual(nationalRecruitingQuery(data, { search: "michael" }).rows.map(row => row.recruitId), [824]);
  assert.deepEqual(nationalRecruitingQuery(data, { position: "HB" }).rows.map(row => row.recruitId), [1]);
  assert.deepEqual(nationalRecruitingQuery(data, { stars: "FIVE_STAR" }).rows.map(row => row.recruitId), [2]);
  assert.deepEqual(nationalRecruitingQuery(data, { state: "Texas" }).rows.map(row => row.recruitId), [1]);
  assert.deepEqual(nationalRecruitingQuery(data, { targeted: "rutgers" }).rows.map(row => row.recruitId), [824]);
  assert.deepEqual(nationalRecruitingQuery(data, { targeted: "not-rutgers" }).rows.map(row => row.recruitId), [2, 1]);
  assert.deepEqual(nationalRecruitingQuery(data, { sort: "name" }).rows.map(row => row.fullName), ["Aaron Alpha", "Michael Jackson", "Zane Zebra"]);
  assert.equal(JSON.stringify(data), before);
  assert.equal(data.recruitingBoard[0].allocatedRecruitingHours, 50);
});

test("paginates national recruits at stable boundaries and supports reset defaults", () => {
  const data = payload();
  data.nationalRecruiting = Array.from({ length: NATIONAL_RECRUIT_PAGE_SIZE + 1 }, (_, index) => ({
    recruitId: index + 1, fullName: `Recruit ${index + 1}`, position: "WR", stars: "FOUR_STAR",
    nationalRank: index + 1, positionRank: index + 1, stateRank: null, homeState: null,
    rutgersTargeted: false, rutgersBoardOrder: null
  }));
  const first = nationalRecruitingQuery(data);
  const second = nationalRecruitingQuery(data, { page: 2 });
  assert.equal(first.rows.length, NATIONAL_RECRUIT_PAGE_SIZE);
  assert.equal(second.rows.length, 1);
  assert.equal(second.rows[0].recruitId, NATIONAL_RECRUIT_PAGE_SIZE + 1);
  assert.match(nationalRecruitingDatabase(data, { search: "missing" }), /No prospects match these filters/);
  assert.match(nationalRecruitingDatabase(data), /Active filters:<\/strong> None/);
});

test("renders only each recruit's own visit and safely labels no visit", () => {
  const first = entry({
    recruitId: 1,
    fullName: "Gerald Blecher",
    scheduledVisit: { week: 3, weekType: "RegularSeason", activity: "FamilyVisit" }
  });
  const second = entry({ recruitId: 2, fullName: "Lee Barrett", boardOrder: 1, boardSlot: 8, scheduledVisit: null });
  const data = payload([first, second]);
  const gerald = normalizedRecruitDetailHtml(data, 1, "my");
  const lee = normalizedRecruitDetailHtml(data, 2, "my");
  assert.match(gerald, /Week 3/);
  assert.match(gerald, /FamilyVisit/);
  assert.doesNotMatch(lee, /Week 3|FamilyVisit/);
  assert.match(lee, /None scheduled/);
});

test("renders verified, explicit negative, and unresolved scouting states", () => {
  const data = payload([
    entry({ recruitId: 1, scoutedStatus: "yes", scoutingPercentage: null }),
    entry({ recruitId: 2, boardOrder: 1, scoutedStatus: "no", scoutingPercentage: null }),
    entry({ recruitId: 3, boardOrder: 2, scoutedStatus: "unresolved", scoutingPercentage: null })
  ]);
  assert.match(normalizedRecruitDetailHtml(data, 1, "my"), /<small>Scouted<\/small><strong>Yes[\s\S]*Percentage unavailable/);
  assert.match(normalizedRecruitDetailHtml(data, 2, "my"), /<small>Scouted<\/small><strong>No/);
  assert.match(normalizedRecruitDetailHtml(data, 3, "my"), /<small>Scouted<\/small><strong>Unresolved/);
});

test("keeps My Board and National Board separate with shared recruit identity", () => {
  const board = [entry({ recruitId: 824, fullName: "Michael Jackson", allocatedRecruitingHours: 50 })];
  const data = payload(board);
  data.nationalRecruiting.push({
    recruitId: 99, fullName: "National Only", position: "LT", stars: "THREE_STAR",
    nationalRank: 200, positionRank: 20, stateRank: 8, homeState: "Ohio",
    rutgersTargeted: false, rutgersBoardOrder: null
  });
  const my = normalizedRecruitingHtml(data, "board", "my");
  const national = normalizedRecruitingHtml(data, "board", "national");
  assert.match(my, />My Board</);
  assert.doesNotMatch(my, /National Only/);
  assert.match(national, />National Board</);
  assert.match(national, /Michael Jackson/);
  assert.match(national, /National Only/);
  assert.equal(normalizedRecruitById(data, 824).recruitId, 824);
  assert.equal(normalizedRecruitById(data, 99).rutgersTargeted, false);
  assert.equal(data.recruitingBoard[0].allocatedRecruitingHours, 50);
});

test("maps exact positions into roster-style recruiting groups", () => {
  const cases = {
    QB: ["QB"], RB: ["HB", "RB", "FB"], WR: ["WR"], TE: ["TE"],
    OL: ["LT", "LG", "C", "RG", "RT"], DL: ["LE", "RE", "DE", "DT"],
    LB: ["LOLB", "ROLB", "MLB", "OLB", "ILB", "LB"],
    DB: ["CB", "FS", "SS", "DB"], ATH: ["ATH"], "K/P": ["K", "P"]
  };
  for (const [group, positions] of Object.entries(cases)) {
    for (const position of positions) {
      assert.equal(recruitPositionGroup(position), group);
      assert.equal(recruitMatchesPositionGroup({ position }, group), true);
    }
  }
  assert.equal(recruitMatchesPositionGroup({ position: "LT" }, "DL"), false);
});

test("compact rows use recruit ID and never board slot as identity", () => {
  const row = recruitCompactRow(entry({ recruitId: 824, boardSlot: 2, position: "QB" }), "my");
  assert.match(row, /data-recruit-id="824"/);
  assert.match(row, /showNormalizedRecruitDetail\('824','my'\)/);
  assert.doesNotMatch(row, /showNormalizedRecruitDetail\('2'/);
});

test("national-only detail never inherits Rutgers recruiting actions", () => {
  const data = payload([entry({ recruitId: 1, allocatedRecruitingHours: 50, scholarshipStatus: "Offered" })]);
  data.nationalRecruiting.push({
    recruitId: 2, fullName: "National Only", position: "CB", stars: "FOUR_STAR",
    nationalRank: 10, positionRank: 2, stateRank: 1, homeState: "Texas",
    allocatedRecruitingHours: 99, scholarshipStatus: "Offered", scheduledVisit: { week: 2 }
  });
  const detail = normalizedRecruitDetailHtml(data, 2, "national");
  assert.match(detail, /Rutgers Board<\/small><strong>No/);
  assert.doesNotMatch(detail, /Assigned hours|Board slot|Scholarship|Visit<\/small>|Pitch<\/small>|Weekly change/);
});

test("ratings reveal only explicit validated values and otherwise render N/A", () => {
  const rawOnly = recruitRatingVisibility({ ratings: { speed: 94, awareness: 0 } });
  assert.deepEqual(rawOnly.map(row => row.value), ["N/A", "N/A"]);
  const partial = recruitRatingVisibility({
    ratings: { speed: 94, awareness: 80, strength: 75 },
    revealedRatings: { speed: 94 }
  });
  assert.equal(partial.find(row => row.key === "speed").value, 94);
  assert.equal(partial.find(row => row.key === "awareness").value, "N/A");
  assert.equal(partial.find(row => row.key === "strength").value, "N/A");
  assert.equal(recruitOverallDisplay({ overall: 99 }), null);
  assert.equal(recruitOverallDisplay({ validatedOverall: 82 }), 82);
});

test("My Board position groups preserve source order without mutation", () => {
  const board = [
    entry({ recruitId: 1, position: "LT", boardOrder: 0 }),
    entry({ recruitId: 2, position: "QB", boardOrder: 1 }),
    entry({ recruitId: 3, position: "RT", boardOrder: 2 })
  ];
  const data = payload(board);
  const before = JSON.stringify(data);
  const html = myBoardRecruitingList(data, "OL");
  assert.ok(html.indexOf('data-recruit-id="1"') < html.indexOf('data-recruit-id="3"'));
  assert.doesNotMatch(html, /data-recruit-id="2"/);
  assert.equal(JSON.stringify(data), before);
});
