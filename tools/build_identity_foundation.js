const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function writeJson(rel, value) {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeId(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function deterministicPlayerId(player, teamPrefix = 'rut') {
  return `${teamPrefix}-${normalizeId(player.position)}-${normalizeId(player.name)}`;
}

function deterministicProspectId(prospect, suffix = '') {
  return `rec-${normalizeId(prospect.position)}-${normalizeId(prospect.name)}${suffix ? `-${suffix}` : ''}`;
}

function deterministicPlayId(play) {
  return `play-${normalizeId([play.formation_family || play.formationFamily, play.set_or_subformation || play.set, play.play_name || play.name].filter(Boolean).join(' '))}`;
}

function runStaticBundle(rel, context) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), context, { filename: rel });
}

const context = { window: {} };
vm.createContext(context);
for (const rel of [
  'data/rutgers_playbook.js'
]) {
  runStaticBundle(rel, context);
}

const roster = readJson('data/rutgers_roster_base.json');
const opponentPlayers = readJson('data/purdue_opponent_players.json');
const recruitingClass = readJson('data/recruiting_class.json');
const recruitingWeekly = readJson('data/recruiting_weekly.json');
const rutgersMedia = readJson('data/base/rutgers_player_media.json');
const opponentMedia = readJson('data/weekly/opponent_player_media.json');
const rutgersLast = readJson('data/rutgers_last_game_stats.json');
const rutgersSeason = readJson('data/rutgers_season_stats.json');
const opponentLast = readJson('data/opponent_last_game_stats.json');
const opponentSeason = readJson('data/opponent_season_stats.json');
const playerCardRegistry = readJson('data/base/player_card_registry.json');
const transcript = readJson('data/OREGON_PLAYBOOK_VISIBLE_TRANSCRIPT_VERIFIED.json');
const playbook = context.window.RUTGERS_PLAYBOOK || [];

const migration = [];
function migrationRow(entityType, legacyId, canonicalId, name, status, referencesUpdated = []) {
  migration.push({
    entity_type: entityType,
    legacy_id: legacyId || null,
    canonical_id: canonicalId,
    name,
    status,
    references_updated: referencesUpdated
  });
}

const statRefs = (stats, id) => Object.entries(stats)
  .filter(([, value]) => Array.isArray(value) && value.some(row => row.player_id === id))
  .map(([key]) => key);

const rutgersMediaIds = new Set((rutgersMedia.players || []).map(row => row.player_id));
const opponentMediaIds = new Set((opponentMedia.players || []).map(row => row.player_id));
const rutgersCardIds = new Set((playerCardRegistry.rutgers_cards || []).map(row => row.player_id));
const opponentCardIds = new Set((playerCardRegistry.opponent_cards || []).map(row => row.player_id));
const weeklyProspectIds = new Set((recruitingWeekly.active_board || []).map(row => row.prospect_id));
const opponentSourceIds = new Set((opponentPlayers.players || []).map(row => row.player_id));

const playerRecords = [];
for (const player of roster.players || []) {
  const canonicalId = player.player_id || deterministicPlayerId(player, 'rut');
  const status = player.player_id ? 'preserved' : 'created';
  playerRecords.push({
    entity_type: 'rutgers_player',
    player_id: canonicalId,
    name: player.name,
    position: player.position,
    team_id: 'rutgers',
    roster_ref: 'data/rutgers_roster_base.json',
    media_ref: rutgersMediaIds.has(canonicalId) ? 'data/base/rutgers_player_media.json' : null,
    last_game_ref: statRefs(rutgersLast, canonicalId).length ? 'data/rutgers_last_game_stats.json' : null,
    season_ref: statRefs(rutgersSeason, canonicalId).length ? 'data/rutgers_season_stats.json' : null,
    card_ref: rutgersCardIds.has(canonicalId) ? 'data/base/player_card_registry.json' : null,
    matchup_ref: 'data/player_matchups.json',
    canonical_status: status,
    generated_rule: status === 'created' ? 'rut-{position}-{normalized-name}' : null
  });
  migrationRow('player', player.player_id || null, canonicalId, player.name, status);
}

for (const player of opponentPlayers.players || []) {
  const teamPrefix = 'pur';
  const canonicalId = player.player_id || deterministicPlayerId(player, teamPrefix);
  const status = player.player_id ? 'preserved' : 'created';
  playerRecords.push({
    entity_type: 'opponent_player',
    opponent_player_id: canonicalId,
    player_id: canonicalId,
    name: player.name,
    position: player.position,
    team_id: 'purdue',
    roster_ref: 'data/purdue_opponent_players.json',
    media_ref: opponentMediaIds.has(canonicalId) ? 'data/weekly/opponent_player_media.json' : null,
    last_game_ref: statRefs(opponentLast, canonicalId).length ? 'data/opponent_last_game_stats.json' : null,
    season_ref: statRefs(opponentSeason, canonicalId).length ? 'data/opponent_season_stats.json' : null,
    card_ref: opponentCardIds.has(canonicalId) ? 'data/base/player_card_registry.json' : null,
    matchup_ref: 'data/player_matchups.json',
    canonical_status: status,
    generated_rule: status === 'created' ? '{team-abbreviation}-{position}-{normalized-name}' : null
  });
  migrationRow('player', player.player_id || null, canonicalId, player.name, status);
}

const opponentStatOnlyRows = new Map();
for (const row of [...Object.values(opponentLast).filter(Array.isArray).flat(), ...Object.values(opponentSeason).filter(Array.isArray).flat()]) {
  if (row.player_id && !opponentSourceIds.has(row.player_id)) {
    opponentStatOnlyRows.set(row.player_id, row);
  }
}

for (const row of opponentStatOnlyRows.values()) {
  const canonicalId = row.player_id;
  const positionFromId = canonicalId.split('-')[1] ? canonicalId.split('-')[1].toUpperCase() : null;
  playerRecords.push({
    entity_type: 'opponent_player',
    opponent_player_id: canonicalId,
    player_id: canonicalId,
    name: row.name,
    position: positionFromId,
    team_id: 'purdue',
    roster_ref: null,
    media_ref: null,
    last_game_ref: statRefs(opponentLast, canonicalId).length ? 'data/opponent_last_game_stats.json' : null,
    season_ref: statRefs(opponentSeason, canonicalId).length ? 'data/opponent_season_stats.json' : null,
    card_ref: null,
    matchup_ref: null,
    canonical_status: 'preserved',
    source_status: 'stat_only_identity',
    generated_rule: null
  });
  migrationRow('player', canonicalId, canonicalId, row.name, 'preserved');
}

const prospectIds = new Map();
const prospectRecords = [];
for (const prospect of recruitingClass.prospects || []) {
  let canonicalId = prospect.prospect_id || deterministicProspectId(prospect);
  if (!prospect.prospect_id) {
    let counter = 2;
    while (prospectIds.has(canonicalId)) {
      canonicalId = deterministicProspectId(prospect, String(counter).padStart(2, '0'));
      counter += 1;
    }
  }
  const status = prospect.prospect_id ? 'preserved' : 'created';
  prospectIds.set(canonicalId, prospect);
  prospectRecords.push({
    prospect_id: canonicalId,
    name: prospect.name,
    position: prospect.position,
    class_ref: 'data/recruiting_class.json',
    board_ref: weeklyProspectIds.has(canonicalId) ? 'data/recruiting_weekly.json#active_board' : null,
    scouting_ref: 'data/recruiting_class.json',
    recommendation_ref: weeklyProspectIds.has(canonicalId) ? 'data/recruiting_weekly.json#active_board' : null,
    canonical_status: status,
    generated_rule: status === 'created' ? 'rec-{position}-{normalized-name}-{disambiguator-if-needed}' : null
  });
  migrationRow('prospect', prospect.prospect_id || null, canonicalId, prospect.name, status);
}

const transcriptKeys = new Set((transcript.verified_visible_master_inventory || []).map(row => [
  row.formation_family,
  row.set_or_subformation,
  row.play_name
].join('::')));

const playRecords = [];
for (const play of playbook) {
  const canonicalId = play.id || deterministicPlayId(play);
  const status = play.id ? 'preserved' : 'created';
  const verifiedKey = play.verifiedVisibleKey || [play.formationFamily, play.set, play.name].join('::');
  playRecords.push({
    play_id: canonicalId,
    play_name: play.name,
    formation_family: play.formationFamily || null,
    set_or_subformation: play.set || null,
    personnel: play.personnel || null,
    category: play.family || null,
    concept: play.conceptFamily || null,
    direction: play.direction || null,
    verified_visible_key: verifiedKey,
    playbook_ref: 'data/OREGON_PLAYBOOK_VISIBLE_TRANSCRIPT_VERIFIED.json',
    static_bundle_ref: 'data/rutgers_playbook.js',
    art_ref: play.diagramPath || 'assets/play-diagrams/formation-fallback.svg',
    verification_status: play.visibilityStatus || (transcriptKeys.has(verifiedKey) ? 'VERIFIED_VISIBLE' : null),
    canonical_status: status,
    generated_rule: status === 'created' ? 'play-{formation-family}-{set-or-subformation}-{play-name}' : null
  });
  migrationRow('play', play.id || null, canonicalId, play.name, status);
}

const generatedAt = new Date().toISOString();
writeJson('data/base/player_identity_registry.json', {
  package_type: 'player_identity_registry',
  schema_version: '1.0',
  generated_at: generatedAt,
  id_rules: {
    rutgers_player: 'Preserve existing valid unique player_id; otherwise rut-{position}-{normalized-name}.',
    opponent_player: 'Preserve existing valid unique player_id; otherwise {team-abbreviation}-{position}-{normalized-name}.',
    normalization: 'lowercase, hyphen-separated, punctuation removed, no random UUIDs.'
  },
  counts: {
    rutgers_players: (roster.players || []).length,
    opponent_players: (opponentPlayers.players || []).length,
    opponent_stat_only_players: opponentStatOnlyRows.size,
    total_players: playerRecords.length
  },
  players: playerRecords
});

writeJson('data/base/prospect_identity_registry.json', {
  package_type: 'prospect_identity_registry',
  schema_version: '1.0',
  generated_at: generatedAt,
  id_rules: {
    prospect: 'Preserve existing valid unique prospect_id; otherwise rec-{position}-{normalized-name}-{disambiguator-if-needed}.',
    normalization: 'lowercase, hyphen-separated, punctuation removed, no random UUIDs.'
  },
  counts: {
    prospects: prospectRecords.length,
    active_board: (recruitingWeekly.active_board || []).length
  },
  prospects: prospectRecords
});

writeJson('data/base/play_identity_registry.json', {
  package_type: 'play_identity_registry',
  schema_version: '1.0',
  generated_at: generatedAt,
  id_rules: {
    play: 'Preserve existing valid unique play id from static verified playbook bundle; otherwise play-{formation-family}-{set-or-subformation}-{play-name}.',
    verified_key: 'formation_family + set_or_subformation + play_name.',
    normalization: 'lowercase, hyphen-separated, punctuation removed, no random UUIDs.'
  },
  counts: {
    verified_visible_plays: playRecords.length,
    transcript_verified_visible_records: (transcript.verified_visible_master_inventory || []).length
  },
  plays: playRecords
});

writeJson('data/migrations/identity_id_map.json', {
  package_type: 'identity_id_map',
  schema_version: '1.0',
  generated_at: generatedAt,
  id_rules_ref: [
    'data/base/player_identity_registry.json#id_rules',
    'data/base/prospect_identity_registry.json#id_rules',
    'data/base/play_identity_registry.json#id_rules'
  ],
  mappings: migration
});

console.log(`Generated identity registries: ${playerRecords.length} players, ${prospectRecords.length} prospects, ${playRecords.length} plays, ${migration.length} migration rows.`);
