"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeRecruiting } = require("../tools/recruiting_normalizer");

function recruit(id, overrides = {}) {
  return {
    id,
    class: "HighSchool",
    nationalRank: id,
    schoolInterest: [{ teamId: 78, teamName: "Rutgers", influence: 10 }],
    player: {
      id: 1000 + id,
      firstName: `First${id}`,
      lastName: `Last${id}`,
      position: "QB",
      archetype: "QB_FieldGeneral",
      archetypeLabel: "Field General",
      starRating: "THREE_STAR",
      overall: 70,
      homeTown: "Town",
      homeState: "New Jersey",
      homePipeline: "New Jersey"
    },
    ...overrides
  };
}

function pursuit(teamId, recruitId, boardOrder, boardSlot, overrides = {}) {
  return {
    recruitId,
    pursuitOwnerTeamId: teamId,
    pursuitOwnerTeamName: teamId === 78 ? "Rutgers" : "CPU",
    activeBoardMembership: true,
    boardOrder,
    boardSlot,
    allocatedRecruitingHours: null,
    scholarshipStatus: "",
    offerOwnerTeamId: null,
    currentNILOffer: null,
    pitchOwnerTeamId: teamId,
    activePitches: null,
    visitOwnerTeamId: teamId,
    scheduledVisit: null,
    prospectInfluenceTotal: 100,
    prospectInfluenceDelta: 5,
    committedTeamId: null,
    signedTeamId: null,
    commitmentOwnershipStatus: "unresolved",
    ...overrides
  };
}

function fixture(recruiting = [], recruits = [recruit(1), recruit(2), recruit(3)]) {
  return {
    teams: [
      { id: 78, displayName: "Rutgers", recruitingBoard: { recruitingHoursAssigned: 0, recruitingHoursProcessed: 0, recruitingHoursTotal: 350 } },
      { id: 5, displayName: "CPU", recruitingBoard: { recruitingHoursAssigned: 20, recruitingHoursProcessed: 10, recruitingHoursTotal: 500 } }
    ],
    recruits,
    recruiting
  };
}

test("normalizes the verified empty Rutgers board without fabrication", () => {
  const result = normalizeRecruiting(fixture([pursuit(5, 1, 0, 4)]));
  assert.deepEqual(result.recruitingSummary, {
    teamId: 78, teamName: "Rutgers", boardCount: 0, offerCount: 0,
    assignedHours: 0, processedHours: 0, totalHours: 350, pitchCount: 0, visitCount: 0
  });
  assert.deepEqual(result.recruitingBoard, []);
  assert.deepEqual(result.recruitingOffers, []);
  assert.deepEqual(result.recruitingVisits, []);
  assert.deepEqual(result.recruitingPitches, []);
});

test("preserves populated CPU board order and sparse slots", () => {
  const rows = [pursuit(5, 2, 0, 3), pursuit(5, 1, 1, 9)];
  const result = normalizeRecruiting(fixture(rows), 5);
  assert.deepEqual(result.recruitingBoard.map(row => row.recruitId), [2, 1]);
  assert.deepEqual(result.recruitingBoard.map(row => row.boardSlot), [3, 9]);
  assert.deepEqual(result.recruitingBoard.map(row => row.boardOrder), [0, 1]);
  assert.ok(result.recruitingBoard.every(row => row.pursuitOwnerTeamId === 5));
});

test("filters offers, pitches, and visits from explicit owned state", () => {
  const rows = [
    pursuit(5, 1, 0, 0, {
      scholarshipStatus: "Offered", offerOwnerTeamId: 5,
      activePitches: [{ pitch: "Prestigious", intensity: "HardSell" }],
      scheduledVisit: { week: 8, weekType: "RegularSeason", activity: "AttendGame" }
    }),
    pursuit(5, 2, 1, 1, { scholarshipStatus: "", offerOwnerTeamId: null, activePitches: null, scheduledVisit: null })
  ];
  const result = normalizeRecruiting(fixture(rows), 5);
  assert.deepEqual(result.recruitingOffers.map(row => row.recruitId), [1]);
  assert.deepEqual(result.recruitingPitches.map(row => row.recruitId), [1]);
  assert.deepEqual(result.recruitingVisits.map(row => row.recruitId), [1]);
});

test("preserves null commitment/signing ownership and unknown source values", () => {
  const result = normalizeRecruiting(fixture([pursuit(5, 1, 0, 0)]), 5);
  const entry = result.recruitingBoard[0];
  assert.equal(entry.committedTeamId, null);
  assert.equal(entry.signedTeamId, null);
  assert.equal(entry.commitmentOwnershipStatus, "unresolved");
  assert.equal(entry.signingOwnershipStatus, "unresolved");
  assert.equal(entry.allocatedRecruitingHours, null);
  assert.equal(entry.scholarshipStatus, null);
});

test("national catalog is independent of selected team board membership", () => {
  const result = normalizeRecruiting(fixture([pursuit(5, 1, 0, 0)]));
  assert.deepEqual(result.recruitingBoard, []);
  assert.deepEqual(result.nationalRecruiting.map(row => row.recruitId), [1, 2, 3]);
  assert.deepEqual(result.nationalRecruiting[0].schoolInterest[0], { teamId: 78, teamName: "Rutgers", influence: 10 });
});

test("rejects duplicate team/recruit membership", () => {
  assert.throws(
    () => normalizeRecruiting(fixture([pursuit(5, 1, 0, 0), pursuit(5, 1, 1, 1)]), 5),
    /Duplicate team\/recruit memberships/
  );
});

test("rejects unresolved recruit references", () => {
  assert.throws(() => normalizeRecruiting(fixture([pursuit(5, 99, 0, 0)]), 5), /Unresolved recruiting references/);
});

test("rejects non-increasing board order", () => {
  assert.throws(
    () => normalizeRecruiting(fixture([pursuit(5, 1, 1, 0), pursuit(5, 2, 1, 2)]), 5),
    /Recruiting board order errors/
  );
});

test("keeps team boards isolated and reports all populated boards", () => {
  const rows = [pursuit(5, 1, 0, 0), pursuit(78, 2, 0, 7)];
  const result = normalizeRecruiting(fixture(rows), 78);
  assert.deepEqual(result.recruitingBoard.map(row => row.recruitId), [2]);
  assert.equal(result.validation.populatedTeamBoardCount, 2);
  assert.equal(result.validation.normalizedMembershipCount, 2);
});

test("uses board-level hours and reconciles explicit per-recruit hours", () => {
  const raw = fixture([pursuit(5, 1, 0, 0, { allocatedRecruitingHours: 20 })]);
  const result = normalizeRecruiting(raw, 5);
  assert.equal(result.recruitingSummary.assignedHours, 20);
  assert.equal(result.recruitingSummary.processedHours, 10);
  assert.equal(result.recruitingSummary.totalHours, 500);
});

test("is idempotent and produces stable ordering", () => {
  const raw = fixture([pursuit(5, 2, 0, 5), pursuit(5, 1, 1, 8)]);
  const first = normalizeRecruiting(raw, 5);
  const second = normalizeRecruiting(JSON.parse(JSON.stringify(raw)), 5);
  assert.deepEqual(second, first);
  assert.deepEqual(first.nationalRecruiting.map(row => row.recruitId), [1, 2, 3]);
});
