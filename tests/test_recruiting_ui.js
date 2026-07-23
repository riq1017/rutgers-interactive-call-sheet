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
  validateNormalizedRecruitingPayload
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
    nationalRecruiting: [],
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

test("renders populated board fields in stable stored order", () => {
  const board = [entry(), entry({ recruitId: 10, fullName: "Taylor Knight", boardOrder: 1, boardSlot: 11 })];
  const html = normalizedRecruitingHtml(payload(board));
  assert.ok(html.indexOf("Sam Scarlet") < html.indexOf("Taylor Knight"));
  for (const value of ["Field General", "Piscataway, New Jersey", "Slot 4", "Commitment ownership: Unresolved", "Signing ownership: Unresolved"]) assert.match(html, new RegExp(value));
});

test("renders null fields as unknown without inventing commitment state", () => {
  const html = normalizedRecruitingHtml(payload([entry()]));
  assert.match(html, /Unknown/);
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
});
