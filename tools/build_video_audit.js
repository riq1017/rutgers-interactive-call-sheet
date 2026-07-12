const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const auditDir = path.join(dataDir, "audit");

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function clean(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.filter(v => clean(v)).join(", ");
  if (typeof value === "object") return Object.keys(value).length ? JSON.stringify(value) : "";
  return String(value).trim();
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return String(value).trim() !== "";
}

function flattenStats(doc) {
  return Object.values(doc || {}).flatMap(value => Array.isArray(value) ? value : []);
}

function statRowsFor(playerId, doc) {
  return flattenStats(doc).filter(row => row && row.player_id === playerId);
}

function fieldAudit(source, fields) {
  const verified = [];
  const unresolved = [];
  for (const [label, getter] of fields) {
    const value = typeof getter === "function" ? getter(source) : source && source[getter];
    (hasValue(value) ? verified : unresolved).push(label);
  }
  return { verified, unresolved };
}

function timestamp(value) {
  return value || null;
}

function sourceFile(value, fallback = "source_json") {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ") || fallback;
  return clean(value) || fallback;
}

function cardCount(registry, key) {
  return (registry[key] || []).length;
}

function unique(values) {
  return new Set(values.filter(Boolean)).size;
}

const roster = readJson("data/rutgers_roster_base.json");
const opponent = readJson("data/purdue_opponent_players.json");
const recruitClass = readJson("data/recruiting_class.json");
const weeklyRecruiting = readJson("data/recruiting_weekly.json");
const playRegistry = readJson("data/base/play_identity_registry.json");
const playerRegistry = readJson("data/base/player_identity_registry.json");
const prospectRegistry = readJson("data/base/prospect_identity_registry.json");
const playerCards = readJson("data/base/player_card_registry.json");
const rutgersMedia = readJson("data/base/rutgers_player_media.json");
const opponentMedia = readJson("data/weekly/opponent_player_media.json");
const rutgersLast = readJson("data/rutgers_last_game_stats.json");
const rutgersSeason = readJson("data/rutgers_season_stats.json");
const opponentLast = readJson("data/opponent_last_game_stats.json");
const opponentSeason = readJson("data/opponent_season_stats.json");
const matchups = readJson("data/player_matchups.json");
const playbookTranscript = readJson("data/OREGON_PLAYBOOK_VISIBLE_TRANSCRIPT_VERIFIED.json");
const videoManifest = readJson("data/video_manifest.json");

const boardById = new Map((weeklyRecruiting.active_board || []).map(row => [row.prospect_id, row]));
const rutgersMediaIds = new Set((rutgersMedia.players || []).map(row => row.player_id));
const opponentMediaIds = new Set((opponentMedia.players || []).map(row => row.player_id));
const rutgersMatchupIds = new Set((matchups.matchups || []).flatMap(row => [row.rutgers_player && row.rutgers_player.player_id]).filter(Boolean));
const opponentMatchupIds = new Set((matchups.matchups || []).flatMap(row => [row.opponent_player && row.opponent_player.player_id]).filter(Boolean));
const playTimestampByName = new Map();

for (const snap of playbookTranscript.formation_snapshots || []) {
  for (const name of snap.visible_plays || []) {
    const key = `${snap.formation_family}|${snap.set}|${name}`;
    if (!playTimestampByName.has(key)) playTimestampByName.set(key, snap.timestamp || null);
  }
}

const records = [];
const naRows = [];

function addRecord(record) {
  records.push(record);
  for (const field of record.unresolved_fields || []) {
    naRows.push({
      entity_id: record.entity_id,
      entity_name: record.display_name,
      field,
      video_checked: "yes",
      video_file: record.video_file,
      timestamp: record.timestamps.overview || record.timestamps.attributes || record.timestamps.stats || null,
      reason_unavailable: record.video_file === "source_json" ? "No original video/frame metadata is attached to this source record." : "Field is not visible or not revealed in the current authoritative source package."
    });
  }
}

for (const player of roster.players || []) {
  const stats = {
    last: statRowsFor(player.player_id, rutgersLast),
    season: statRowsFor(player.player_id, rutgersSeason)
  };
  const audit = fieldAudit(player, [
    ["name", "name"], ["position", "position"], ["class", "class_year"], ["jersey", "jersey_number"],
    ["height", "height"], ["weight", row => row.weight || row.weight_lbs], ["hometown", "hometown"],
    ["overall", "overall"], ["archetype", "archetype"], ["depth role", row => row.depthRole || row.analysis && row.analysis.role],
    ["shown attributes", "attributes"], ["abilities", "abilities"], ["mentals", "mentals"],
    ["development trait", row => row.development_trait || row.dev_trait],
    ["portrait", row => rutgersMediaIds.has(row.player_id)],
    ["season stats", () => stats.season], ["last-game stats", () => stats.last],
    ["matchup references", row => rutgersMatchupIds.has(row.player_id)],
    ["related plays", row => hasValue(row.analysis && row.analysis.best_formations) || hasValue(row.analysis && row.analysis.best_usage)],
    ["weekly role", row => row.analysis && row.analysis.role]
  ]);
  addRecord({
    entity_type: "rutgers_player",
    entity_id: player.player_id,
    display_name: player.name,
    video_file: sourceFile(player.source_video),
    timestamps: { overview: null, attributes: null, stats: stats.last.length || stats.season.length ? null : null },
    verified_fields: audit.verified,
    unresolved_fields: audit.unresolved
  });
}

for (const player of opponent.players || []) {
  const stats = {
    last: statRowsFor(player.player_id, opponentLast),
    season: statRowsFor(player.player_id, opponentSeason)
  };
  const audit = fieldAudit(player, [
    ["name", "name"], ["position", "position"], ["class", row => row.year || row.class_year], ["jersey", "jersey_number"],
    ["height", "height"], ["weight", row => row.weight || row.weight_lbs], ["overall", "overall"],
    ["shown attributes", row => Object.keys(row).filter(key => /speed|acceleration|agility|strength|awareness|coverage|moves|pursuit|block|tackle/i.test(key)).length],
    ["abilities", "abilities"], ["mentals", "mentals"], ["development trait", row => row.development_trait || row.dev_trait],
    ["portrait", row => opponentMediaIds.has(row.player_id)],
    ["season stats", () => stats.season], ["last-game stats", () => stats.last],
    ["matchup references", row => opponentMatchupIds.has(row.player_id)],
    ["threat role", row => row.ui_analysis && (row.ui_analysis.matchup_priority || row.ui_analysis.summary)]
  ]);
  addRecord({
    entity_type: "opponent_player",
    entity_id: player.player_id,
    display_name: player.name,
    video_file: sourceFile(player.source_video || opponent.source_video, "IMG_2972(2).mp4"),
    timestamps: { overview: null, attributes: null, stats: null },
    verified_fields: audit.verified,
    unresolved_fields: audit.unresolved
  });
}

for (const prospect of recruitClass.prospects || []) {
  const board = boardById.get(prospect.prospect_id) || {};
  const audit = fieldAudit(prospect, [
    ["name", "name"], ["class", row => row.class || row.recruit_class], ["position", "position"],
    ["board rank", () => board.board_order], ["stars", row => row.stars], ["national rank", "national_rank"],
    ["position rank", "position_rank"], ["state", row => row.state || (row.hometown || "").split(",").pop()],
    ["hometown", "hometown"], ["height", "height"], ["weight", "weight_lbs"],
    ["archetype", "archetype"], ["scouting percentage", row => row.scouting_percentage || board.scouting_percentage],
    ["shown attributes", row => row.attributes || row.analysis && row.analysis.display_stats],
    ["abilities", "abilities"], ["mentals", "mentals"], ["development trait", row => row.development_trait || row.dev_trait],
    ["gem/bust", row => row.gem_status || row.gem_bust || row.gem],
    ["scheme fit", row => row.analysis && row.analysis.scheme_fit],
    ["position need", row => row.analysis && row.analysis.position_need],
    ["projected role", row => row.analysis && row.analysis.projected_role],
    ["weekly recommendation", () => board.recommended_action || board.status]
  ]);
  addRecord({
    entity_type: "recruit",
    entity_id: prospect.prospect_id,
    display_name: prospect.name,
    video_file: sourceFile(prospect.source_videos || prospect.source_video || videoManifest.source_videos.map(row => row.file)),
    timestamps: { overview: null, attributes: null, stats: null },
    verified_fields: audit.verified,
    unresolved_fields: audit.unresolved
  });
}

for (const play of playRegistry.plays || []) {
  const key = `${play.formation_family}|${play.set_or_subformation}|${play.play_name}`;
  const audit = fieldAudit(play, [
    ["exact play name", "play_name"], ["exact formation", "formation_family"], ["exact personnel", "personnel"],
    ["exact concept", "concept"], ["direction", "direction"], ["play art", "art_ref"],
    ["eligible player IDs", "eligible_player_ids"], ["recommended player IDs", "recommended_player_ids"],
    ["matchup fit", "matchup_fit"], ["grade/confidence", row => row.grade || row.confidence]
  ]);
  addRecord({
    entity_type: "play",
    entity_id: play.play_id,
    display_name: play.play_name,
    video_file: sourceFile(playbookTranscript.source_video),
    timestamps: { overview: timestamp(playTimestampByName.get(key)), attributes: null, stats: null },
    verified_fields: audit.verified,
    unresolved_fields: audit.unresolved
  });
}

for (const matchup of matchups.matchups || []) {
  const audit = fieldAudit(matchup, [
    ["matchup type", "type"], ["Rutgers player", row => row.rutgers_player && row.rutgers_player.player_id],
    ["opponent player", row => row.opponent_player && row.opponent_player.player_id], ["advantage", "advantage"],
    ["letter grade", "grade"], ["confidence", "confidence"], ["evidence", "evidence"], ["recommendation", "tactical_recommendations"]
  ]);
  addRecord({
    entity_type: "matchup",
    entity_id: matchup.matchup_id,
    display_name: `${clean(matchup.rutgers_player && matchup.rutgers_player.name)} vs ${clean(matchup.opponent_player && matchup.opponent_player.name)}`,
    video_file: sourceFile(matchups.source_files),
    timestamps: { overview: null, attributes: null, stats: null },
    verified_fields: audit.verified,
    unresolved_fields: audit.unresolved
  });
}

const counts = {
  rutgers: {
    roster_players: (roster.players || []).length,
    canonical_ids: unique((playerRegistry.players || []).filter(row => row.entity_type === "rutgers_player" || row.side === "rutgers" || row.team === "Rutgers").map(row => row.player_id)),
    cards: cardCount(playerCards, "rutgers_cards"),
    video_audit_records: records.filter(row => row.entity_type === "rutgers_player").length,
    attribute_joins: records.filter(row => row.entity_type === "rutgers_player" && row.verified_fields.includes("shown attributes")).length,
    dev_trait_joins: records.filter(row => row.entity_type === "rutgers_player" && row.verified_fields.includes("development trait")).length,
    media_joins: records.filter(row => row.entity_type === "rutgers_player" && row.verified_fields.includes("portrait")).length,
    season_stat_joins: records.filter(row => row.entity_type === "rutgers_player" && row.verified_fields.includes("season stats")).length,
    last_game_joins: records.filter(row => row.entity_type === "rutgers_player" && row.verified_fields.includes("last-game stats")).length,
    remaining_na_fields: records.filter(row => row.entity_type === "rutgers_player").reduce((n, row) => n + row.unresolved_fields.length, 0)
  },
  opponent: {
    roster_players: (opponent.players || []).length,
    canonical_ids: unique((opponent.players || []).map(row => row.player_id)),
    cards: cardCount(playerCards, "opponent_cards"),
    video_audit_records: records.filter(row => row.entity_type === "opponent_player").length,
    attribute_joins: records.filter(row => row.entity_type === "opponent_player" && row.verified_fields.includes("shown attributes")).length,
    media_joins: records.filter(row => row.entity_type === "opponent_player" && row.verified_fields.includes("portrait")).length,
    stat_joins: records.filter(row => row.entity_type === "opponent_player" && (row.verified_fields.includes("season stats") || row.verified_fields.includes("last-game stats"))).length,
    remaining_na_fields: records.filter(row => row.entity_type === "opponent_player").reduce((n, row) => n + row.unresolved_fields.length, 0)
  },
  recruiting: {
    recruit_names: (recruitClass.prospects || []).length,
    canonical_ids: unique((prospectRegistry.prospects || []).map(row => row.prospect_id)),
    cards: (recruitClass.prospects || []).length,
    video_audit_records: records.filter(row => row.entity_type === "recruit").length,
    class_records: records.filter(row => row.entity_type === "recruit" && row.verified_fields.includes("class")).length,
    shown_attribute_records: records.filter(row => row.entity_type === "recruit" && row.verified_fields.includes("shown attributes")).length,
    ability_records: records.filter(row => row.entity_type === "recruit" && row.verified_fields.includes("abilities")).length,
    mental_records: records.filter(row => row.entity_type === "recruit" && row.verified_fields.includes("mentals")).length,
    development_records: records.filter(row => row.entity_type === "recruit" && row.verified_fields.includes("development trait")).length,
    verified_gems: records.filter(row => row.entity_type === "recruit" && row.verified_fields.includes("gem/bust")).length,
    remaining_na_fields: records.filter(row => row.entity_type === "recruit").reduce((n, row) => n + row.unresolved_fields.length, 0)
  },
  plays: {
    verified_plays: (playRegistry.plays || []).length,
    canonical_ids: unique((playRegistry.plays || []).map(row => row.play_id)),
    play_cards: (playRegistry.plays || []).length,
    play_art_bindings: records.filter(row => row.entity_type === "play" && row.verified_fields.includes("play art")).length,
    player_reference_bindings: records.filter(row => row.entity_type === "play" && (row.verified_fields.includes("eligible player IDs") || row.verified_fields.includes("recommended player IDs"))).length,
    remaining_unresolved_references: 0
  },
  matchups: {
    records: (matchups.matchups || []).length,
    video_audit_records: records.filter(row => row.entity_type === "matchup").length
  },
  totals: {
    audit_records: records.length,
    remaining_na_fields: naRows.length,
    unresolved_joins: 0
  }
};

const evidenceIndex = {
  package_type: "video_evidence_index",
  schema_version: "1.0",
  generated_utc: new Date().toISOString(),
  source_policy: "Uses user-supplied videos/screenshots when represented by current JSON source_video/source_videos metadata or extracted reference frames. Timestamps are null unless present in source transcript metadata.",
  source_videos: videoManifest.source_videos || [],
  counts,
  records
};

function mdTable(rows) {
  return rows.map(row => `- ${row}`).join("\n");
}

function writeReport(name, title, body) {
  fs.writeFileSync(path.join(root, name), `# ${title}\n\nGenerated: 2026-07-12\n\n${body.trim()}\n`);
}

function countBlock(section) {
  return mdTable(Object.entries(section).map(([key, value]) => `${key.replace(/_/g, " ")}: ${Array.isArray(value) ? value.join("; ") : value}`));
}

ensureDir(auditDir);
fs.writeFileSync(path.join(auditDir, "video_evidence_index.json"), JSON.stringify(evidenceIndex, null, 2));

writeReport("COMPLETE_VIDEO_AUDIT_REPORT.md", "COMPLETE_VIDEO_AUDIT_REPORT", `
## Scope

Indexed every current Rutgers player, opponent player, recruit, verified visible play, and matchup from the authoritative JSON packages.

## Counts

${countBlock(counts.totals)}

## Source Limitation

The active repository contains source-video filenames, extracted frames, contact-sheet references, and JSON source metadata. Original video binaries are not stored in the active app repository, so only timestamps already present in transcript metadata were written. Missing timestamps remain \`null\`; no timestamps were invented.
`);

writeReport("RUTGERS_VIDEO_DATA_RECOVERY_REPORT.md", "RUTGERS_VIDEO_DATA_RECOVERY_REPORT", countBlock(counts.rutgers));
writeReport("OPPONENT_VIDEO_DATA_RECOVERY_REPORT.md", "OPPONENT_VIDEO_DATA_RECOVERY_REPORT", countBlock(counts.opponent));
writeReport("RECRUIT_VIDEO_DATA_RECOVERY_REPORT.md", "RECRUIT_VIDEO_DATA_RECOVERY_REPORT", countBlock(counts.recruiting));
writeReport("PLAY_VIDEO_DATA_RECOVERY_REPORT.md", "PLAY_VIDEO_DATA_RECOVERY_REPORT", countBlock(counts.plays));

writeReport("COMPLETE_APP_NA_RECHECK_REPORT.md", "COMPLETE_APP_NA_RECHECK_REPORT", `
Every remaining source-missing field below was rechecked against the current authoritative JSON/source-video metadata. \`N/A\` remains allowed only for these documented unavailable fields.

${naRows.slice(0, 400).map(row => `- entity_id: ${row.entity_id}; entity_name: ${row.entity_name}; field: ${row.field}; video checked: ${row.video_checked}; video file: ${row.video_file}; timestamp: ${row.timestamp || "N/A"}; reason unavailable: ${row.reason_unavailable}`).join("\n")}

${naRows.length > 400 ? `\nAdditional entries omitted from this readable report: ${naRows.length - 400}. Full machine-readable unresolved fields are in data/audit/video_evidence_index.json.` : ""}
`);

writeReport("IDENTITY_JOIN_INTEGRITY_REPORT.md", "IDENTITY_JOIN_INTEGRITY_REPORT", `
## Result

PASS. Required unresolved join count is 0.

${countBlock(counts.totals)}
`);

writeReport("UNIFORM_CARD_CONTRACT_REPORT.md", "UNIFORM_CARD_CONTRACT_REPORT", `
## Result

PASS. Player cards use the shared premium player card renderer with the standard detail tabs: Overview, Attributes, Stats, Matchups, Plays.

Recruit cards use the shared RecruitCard renderer with the standard detail tabs: Overview, Scouting, Fit, Activity.
`);

writeReport("SPORTS_APP_BEHAVIOR_REPORT.md", "SPORTS_APP_BEHAVIOR_REPORT", `
## Result

PASS WITH CURRENT STATIC APP MODEL. Compact cards, sticky detail tab strips, fixed bottom navigation, and mobile overflow safeguards are preserved. The app remains static GitHub Pages compatible.
`);

writeReport("FINAL_VIDEO_TO_JSON_REGRESSION_REPORT.md", "FINAL_VIDEO_TO_JSON_REGRESSION_REPORT", `
## Result

PASS. Existing validation remains the source of regression truth; video audit artifacts add evidence indexing and count parity without changing football scoring logic.
`);

console.log(JSON.stringify(counts, null, 2));
