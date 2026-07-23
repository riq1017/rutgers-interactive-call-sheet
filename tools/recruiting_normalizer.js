"use strict";

const RUTGERS_TEAM_ID = 78;
const OWNERSHIP_STATUS = "team-board-membership-verified";

function copy(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

function known(value) {
  return value === undefined || value === "" ? null : copy(value);
}

function nameOf(player) {
  if (!player) return null;
  const name = [player.firstName, player.lastName].filter(value => value != null && value !== "").join(" ");
  return name || null;
}

function normalizeInterest(rows) {
  if (!Array.isArray(rows)) return null;
  return rows.map(row => ({
    teamId: known(row.teamId),
    teamName: known(row.teamName),
    influence: known(row.influence)
  }));
}

function normalizeRecruit(recruit) {
  const player = recruit.player || null;
  return {
    recruitId: known(recruit.id),
    playerId: known(player && player.id),
    firstName: known(player && player.firstName),
    lastName: known(player && player.lastName),
    fullName: nameOf(player),
    position: known(player && player.position),
    archetype: known(player && (player.archetypeLabel || player.archetype)),
    archetypeCode: known(player && player.archetype),
    stars: known(player && player.starRating),
    overall: known(player && player.overall),
    nationalRank: known(recruit.nationalRank),
    positionRank: known(recruit.positionRank),
    stateRank: known(recruit.stateRank),
    hometown: known(player && player.homeTown),
    homeState: known(player && player.homeState),
    homePipeline: known(player && player.homePipeline),
    height: known(player && player.height),
    weight: known(player && player.weight),
    developmentTrait: known(player && player.devTrait),
    dealbreaker: known(player && player.recruitingDealbreaker),
    ratings: known(player && player.ratings),
    recruitClass: known(recruit.class),
    recruitStage: known(recruit.recruitStage),
    qualityModifier: known(recruit.qualityModifier),
    productionGrade: known(recruit.productionGrade),
    totalScholarshipOffers: known(recruit.totalScholarshipOffers),
    schoolInterest: normalizeInterest(recruit.schoolInterest)
  };
}

function normalizeBoardEntry(pursuit, recruit) {
  const identity = normalizeRecruit(recruit);
  return {
    ...identity,
    boardSlot: known(pursuit.boardSlot),
    boardOrder: known(pursuit.boardOrder),
    activeBoardMembership: known(pursuit.activeBoardMembership),
    pursuitOwnerTeamId: known(pursuit.pursuitOwnerTeamId),
    pursuitOwnerTeamName: known(pursuit.pursuitOwnerTeamName),
    allocatedRecruitingHours: known(pursuit.allocatedRecruitingHours),
    scholarshipStatus: known(pursuit.scholarshipStatus),
    offerOwnerTeamId: known(pursuit.offerOwnerTeamId),
    currentNILOffer: known(pursuit.currentNILOffer),
    nilExpectation: known(pursuit.nilExpectation),
    pitchOwnerTeamId: known(pursuit.pitchOwnerTeamId),
    activePitches: known(pursuit.activePitches),
    visitOwnerTeamId: known(pursuit.visitOwnerTeamId),
    scheduledVisit: known(pursuit.scheduledVisit),
    prospectInfluenceTotal: known(pursuit.prospectInfluenceTotal),
    prospectInfluenceDelta: known(pursuit.prospectInfluenceDelta),
    schoolInterest: normalizeInterest(pursuit.schoolInterest || recruit.schoolInterest),
    committedTeamId: null,
    signedTeamId: null,
    ownershipStatus: OWNERSHIP_STATUS,
    commitmentOwnershipStatus: "unresolved",
    signingOwnershipStatus: "unresolved",
    commitmentOwnershipProvenance: "not proven by a signing-day snapshot; no inference applied",
    signingOwnershipProvenance: "not proven by a signing-day snapshot; no inference applied",
    ownershipProvenance: "Team -> RecruitingBoard -> Recruits[] -> RecruitTarget -> Recruit"
  };
}

function hasOffer(entry) {
  return entry.scholarshipStatus === "Offered" && entry.offerOwnerTeamId === entry.pursuitOwnerTeamId;
}

function hasVisit(entry) {
  return entry.visitOwnerTeamId === entry.pursuitOwnerTeamId &&
    entry.scheduledVisit !== null &&
    typeof entry.scheduledVisit === "object" &&
    Object.keys(entry.scheduledVisit).length > 0;
}

function hasPitch(entry) {
  return entry.pitchOwnerTeamId === entry.pursuitOwnerTeamId &&
    Array.isArray(entry.activePitches) &&
    entry.activePitches.length > 0;
}

function normalizeRecruiting(raw, teamId = RUTGERS_TEAM_ID) {
  if (!raw || !Array.isArray(raw.teams) || !Array.isArray(raw.recruits) || !Array.isArray(raw.recruiting)) {
    throw new Error("Recruiting normalization requires teams, recruits, and recruiting arrays.");
  }
  const team = raw.teams.find(row => Number(row.id) === Number(teamId));
  if (!team) throw new Error(`Recruiting team ${teamId} is unresolved.`);

  const recruits = new Map();
  for (const recruit of raw.recruits) {
    if (recruit.id == null || !recruit.player) continue;
    const key = String(recruit.id);
    if (recruits.has(key)) throw new Error(`Duplicate recruit ID ${recruit.id}.`);
    recruits.set(key, recruit);
  }

  const memberships = new Set();
  const perTeamOrder = new Map();
  const normalizedByTeam = new Map();
  let populatedTeamBoardCount = 0;
  let duplicateMembershipCount = 0;
  let unresolvedReferenceCount = 0;
  let boardOrderErrorCount = 0;

  for (const pursuit of raw.recruiting) {
    const ownerId = pursuit.pursuitOwnerTeamId;
    const recruit = recruits.get(String(pursuit.recruitId));
    if (ownerId == null || !recruit) {
      unresolvedReferenceCount += 1;
      continue;
    }
    const membership = `${ownerId}:${pursuit.recruitId}`;
    if (memberships.has(membership)) {
      duplicateMembershipCount += 1;
      continue;
    }
    memberships.add(membership);
    const previousOrder = perTeamOrder.get(String(ownerId));
    if (previousOrder != null && Number(pursuit.boardOrder) <= Number(previousOrder)) boardOrderErrorCount += 1;
    perTeamOrder.set(String(ownerId), pursuit.boardOrder);
    if (!normalizedByTeam.has(String(ownerId))) normalizedByTeam.set(String(ownerId), []);
    normalizedByTeam.get(String(ownerId)).push(normalizeBoardEntry(pursuit, recruit));
  }

  if (duplicateMembershipCount) throw new Error(`Duplicate team/recruit memberships: ${duplicateMembershipCount}.`);
  if (unresolvedReferenceCount) throw new Error(`Unresolved recruiting references: ${unresolvedReferenceCount}.`);
  if (boardOrderErrorCount) throw new Error(`Recruiting board order errors: ${boardOrderErrorCount}.`);

  populatedTeamBoardCount = normalizedByTeam.size;
  const board = normalizedByTeam.get(String(teamId)) || [];
  const offers = board.filter(hasOffer);
  const visits = board.filter(hasVisit);
  const pitches = board.filter(hasPitch);
  const boardState = team.recruitingBoard || {};
  const sumAssigned = board.reduce((sum, entry) => sum + (typeof entry.allocatedRecruitingHours === "number" ? entry.allocatedRecruitingHours : 0), 0);
  const sourceAssigned = known(boardState.recruitingHoursAssigned);
  if (sourceAssigned != null && board.some(entry => typeof entry.allocatedRecruitingHours === "number") && sumAssigned !== sourceAssigned) {
    throw new Error(`Assigned recruiting hours do not reconcile for team ${teamId}.`);
  }

  const nationalRecruiting = [...recruits.values()]
    .map(normalizeRecruit)
    .sort((a, b) => Number(a.recruitId) - Number(b.recruitId));
  const recruitingSummary = {
    teamId: known(team.id),
    teamName: known(team.displayName || team.longName),
    boardCount: board.length,
    offerCount: offers.length,
    assignedHours: sourceAssigned,
    processedHours: known(boardState.recruitingHoursProcessed),
    totalHours: known(boardState.recruitingHoursTotal),
    pitchCount: pitches.length,
    visitCount: visits.length
  };

  return {
    schemaVersion: "cfb27_recruiting_normalized_v1",
    recruitingSummary,
    recruitingBoard: board,
    recruitingOffers: offers,
    recruitingVisits: visits,
    recruitingPitches: pitches,
    nationalRecruiting,
    validation: {
      inputPursuitCount: raw.recruiting.length,
      normalizedMembershipCount: memberships.size,
      populatedTeamBoardCount,
      duplicateMembershipCount,
      unresolvedReferenceCount,
      boardOrderErrorCount,
      commitmentOwnership: "unresolved",
      signingOwnership: "unresolved"
    }
  };
}

module.exports = {
  OWNERSHIP_STATUS,
  RUTGERS_TEAM_ID,
  hasOffer,
  hasPitch,
  hasVisit,
  normalizeBoardEntry,
  normalizeRecruit,
  normalizeRecruiting
};
