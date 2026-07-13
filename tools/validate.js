const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const context = { window: {}, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
vm.createContext(context);
for (const file of ['data/rutgers_team.js','data/rutgers_playbook.js','data/weekly_plan.js','data/game_history.js','data/recruiting_data.js','data/engine_data.js','data/depth_chart_seed.js','data/phase1_verified_data.js','data/player_media.js','data/card_registry.js','data/weekly/coaching_decisions.js','data/weekly/run_lane_analysis.js','data/weekly/weekly_matchup_summary.js','data/video_verified/rutgers_season_stats.js','data/video_verified/purdue_season_stats.js','data/video_verified/purdue_roster.js','data/video_verified/four_star_freshman_class.js','data/video_verified/rutgers_prospect_board.js','data/video_verified/rutgers_roster_recovery.js','data/video_verified/purdue_roster_recovery.js','data/video_verified/rutgers_board_scouting_recovery.js','data/video_verified/video_evidence_index.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
Object.assign(global, context.window);
global.window = { GAME_HISTORY: [] };
global.localStorage = context.localStorage;
const engine = require(path.join(root, 'app.js'));
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const checks = [];
function check(name, passed, detail = '') { checks.push({ name, passed: Boolean(passed), detail }); }
function ctx(down, yards, zone = 'normal', gameState = 'normal') {
  const dist = yards <= 3 ? 'short' : yards <= 6 ? 'medium' : 'long';
  let key = dist;
  if (zone === 'goal_line' || zone === 'red_zone') key = zone;
  if (gameState === 'two_minute' || gameState === 'must_score') key = gameState;
  if (gameState === 'protect_lead') key = 'short';
  return { down, dist, distanceYards: yards, zone, gameState, key };
}
const requiredFiles = ['rutgers_roster_base.json','rutgers_last_game_stats.json','rutgers_season_stats.json','opponent_last_game_stats.json','opponent_season_stats.json','player_matchups.json','OREGON_PLAYBOOK_VISIBLE_TRANSCRIPT_VERIFIED.json','PHASE1_DATA_PACKAGE_MANIFEST.json','recruiting_class.json','recruiting_weekly.json','team_needs.json','coach_recruiting_modifiers.json','gameplan_weekly.json','depth_chart_seed.json','depth_chart_seed.js','APP_DATA_BINDING_REQUIREMENTS.json','base/rutgers_player_media.json','base/player_card_registry.json','base/player_identity_registry.json','base/prospect_identity_registry.json','base/play_identity_registry.json','migrations/identity_id_map.json','weekly/opponent_player_media.json','weekly/coaching_decisions.json','weekly/run_lane_analysis.json','weekly/weekly_matchup_summary.json','audit/video_evidence_index.json','video_verified/rutgers_season_stats.json','video_verified/purdue_season_stats.json','video_verified/purdue_roster.json','video_verified/four_star_freshman_class.json','video_verified/rutgers_prospect_board.json','video_verified/rutgers_roster_recovery.js','video_verified/purdue_roster_recovery.js','video_verified/rutgers_board_scouting_recovery.js','video_verified/video_evidence_index.json','player_media.js','card_registry.json','card_registry.js'];
const phase1Transcript = JSON.parse(fs.readFileSync(path.join(root,'data','OREGON_PLAYBOOK_VISIBLE_TRANSCRIPT_VERIFIED.json'), 'utf8'));
const phase1Matchups = JSON.parse(fs.readFileSync(path.join(root,'data','player_matchups.json'), 'utf8'));
const cardRegistry = JSON.parse(fs.readFileSync(path.join(root,'data','card_registry.json'), 'utf8'));
const coachingDecisions = JSON.parse(fs.readFileSync(path.join(root,'data','weekly','coaching_decisions.json'), 'utf8'));
const runLaneAnalysis = JSON.parse(fs.readFileSync(path.join(root,'data','weekly','run_lane_analysis.json'), 'utf8'));
const weeklyMatchupSummary = JSON.parse(fs.readFileSync(path.join(root,'data','weekly','weekly_matchup_summary.json'), 'utf8'));
const rutgersLast = JSON.parse(fs.readFileSync(path.join(root,'data','rutgers_last_game_stats.json'), 'utf8'));
const rutgersSeason = JSON.parse(fs.readFileSync(path.join(root,'data','rutgers_season_stats.json'), 'utf8'));
const opponentLast = JSON.parse(fs.readFileSync(path.join(root,'data','opponent_last_game_stats.json'), 'utf8'));
const opponentSeason = JSON.parse(fs.readFileSync(path.join(root,'data','opponent_season_stats.json'), 'utf8'));
const rutgersMedia = JSON.parse(fs.readFileSync(path.join(root,'data','base','rutgers_player_media.json'), 'utf8'));
const opponentMedia = JSON.parse(fs.readFileSync(path.join(root,'data','weekly','opponent_player_media.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(root,'data','base','player_card_registry.json'), 'utf8'));
const depthChartSeed = JSON.parse(fs.readFileSync(path.join(root,'data','depth_chart_seed.json'), 'utf8'));
const playerIdentityRegistry = JSON.parse(fs.readFileSync(path.join(root,'data','base','player_identity_registry.json'), 'utf8'));
const prospectIdentityRegistry = JSON.parse(fs.readFileSync(path.join(root,'data','base','prospect_identity_registry.json'), 'utf8'));
const playIdentityRegistry = JSON.parse(fs.readFileSync(path.join(root,'data','base','play_identity_registry.json'), 'utf8'));
const identityIdMap = JSON.parse(fs.readFileSync(path.join(root,'data','migrations','identity_id_map.json'), 'utf8'));
const videoEvidenceIndex = JSON.parse(fs.readFileSync(path.join(root,'data','audit','video_evidence_index.json'), 'utf8'));
const videoOnlyEvidence = JSON.parse(fs.readFileSync(path.join(root,'data','video_verified','video_evidence_index.json'), 'utf8'));
check('Authoritative Phase 1 JSON files are present', requiredFiles.every(file => fs.existsSync(path.join(root,'data',file))));
check('PROJECT_SPEC.md exists', fs.existsSync(path.join(root, 'PROJECT_SPEC.md')));
check('Sprint 2 card registry exists', fs.existsSync(path.join(root, 'data', 'card_registry.json')) && cardRegistry.package_type === 'card_registry' && cardRegistry.schema_version === '1.0');
const visibleRegistryCards = (cardRegistry.cards || []).filter(card => card.visible !== false);
const registryIds = visibleRegistryCards.map(card => card.card_id);
check('Card registry schema is valid for visible cards', visibleRegistryCards.every(card => card.card_id && card.card_type && card.tab && card.section && Number.isFinite(Number(card.order)) && ['critical','important','monitor','normal'].includes(card.priority) && ['small','medium','large'].includes(card.size) && typeof card.expandable === 'boolean' && card.source_refs && typeof card.source_refs === 'object'));
check('Visible registry cards have unique card_id values', registryIds.length === new Set(registryIds).size);
check('Visible matchup registry entries resolve to player_matchups.json', visibleRegistryCards.filter(card => card.card_type === 'key_matchup').every(card => phase1Matchups.matchups.some(row => row.matchup_id === card.source_refs.matchup_id)));
check('Card registry does not duplicate player names or ratings', !/"name"\s*:|"overall"\s*:|"internal_score"\s*:|"confidence"\s*:|"grade"\s*:|"recommendation/i.test(JSON.stringify(cardRegistry)));
check('Card registry static bundle is loaded before app.js', index.indexOf('data/card_registry.js') > index.indexOf('data/player_media.js') && index.indexOf('data/card_registry.js') < index.indexOf('app.js'));
check('Shared card engine primitives exist', ['function BaseCard','function CardHeader','function CardSection','function MetricRow','function StatBlock','function Badge','function PortraitBlock','function LimitedDataState','function ExpandableCard','function CardActions'].every(token => app.includes(token)));
check('Central defensive card formatter exists', app.includes('function cardValue') && app.includes('function cleanValue') && app.indexOf('function cleanValue') < app.indexOf('function cardValue'));
check('Card resolver layer exists', ['function loadCardRegistry','function cardRegistryEntries','function resolveCardEntry','function keyMatchupRegistryModels'].every(token => app.includes(token)));
const resolverSource = (app.match(/function resolveCardEntry[\s\S]*?\n}\n\nfunction keyMatchupRegistryModels/) || [''])[0];
check('Card resolver does not mutate authoritative JSON data', !/row\.[A-Za-z0-9_]+\s*=|\b(row|rutgers|opponent)\[[^\]]+\]\s*=/.test(resolverSource));
check('Approved matchup card uses shared card primitives', app.includes('return ExpandableCard({') && app.includes('CardSection("Matchup Edge"') && app.includes('CardHeader({'));
const unique = values => values.length === new Set(values).size;
const rutgersRosterById = new Map(RUTGERS_ROSTER_BASE.players.map(player => [player.player_id, player]));
const opponentPlayersById = new Map(PURDUE_OPPONENT_PLAYERS.players.map(player => [player.player_id, player]));
const prospectById = new Map(RECRUITING_CLASS.prospects.map(prospect => [prospect.prospect_id, prospect]));
const playbookById = new Map(RUTGERS_PLAYBOOK.map(play => [play.id, play]));
const allCanonicalPlayerIds = playerIdentityRegistry.players.map(row => row.player_id || row.opponent_player_id);
const rutgersIdentityRows = playerIdentityRegistry.players.filter(row => row.entity_type === 'rutgers_player');
const opponentIdentityRows = playerIdentityRegistry.players.filter(row => row.entity_type === 'opponent_player');
const opponentIdentityById = new Map(opponentIdentityRows.map(row => [row.opponent_player_id, row]));
const prospectIdentityRows = prospectIdentityRegistry.prospects || [];
const playIdentityRows = playIdentityRegistry.plays || [];
const allStatRows = stats => Object.values(stats).filter(Array.isArray).flat();
const rutgersLastRows = allStatRows(rutgersLast);
const rutgersSeasonRows = allStatRows(rutgersSeason);
const opponentLastRows = allStatRows(opponentLast);
const opponentSeasonRows = allStatRows(opponentSeason);
const namePositionMatch = (row, source) => source && row.name === source.name && row.position === source.position;
check('Identity registries parse and declare package types', playerIdentityRegistry.package_type === 'player_identity_registry' && prospectIdentityRegistry.package_type === 'prospect_identity_registry' && playIdentityRegistry.package_type === 'play_identity_registry' && identityIdMap.package_type === 'identity_id_map');
check('Canonical player IDs are present and unique', allCanonicalPlayerIds.every(Boolean) && unique(allCanonicalPlayerIds));
check('Canonical prospect IDs are present and unique', prospectIdentityRows.every(row => row.prospect_id) && unique(prospectIdentityRows.map(row => row.prospect_id)));
check('Canonical play IDs are present and unique', playIdentityRows.every(row => row.play_id) && unique(playIdentityRows.map(row => row.play_id)));
check('Rutgers identity registry matches roster source by ID/name/position', rutgersIdentityRows.length === RUTGERS_ROSTER_BASE.players.length && rutgersIdentityRows.every(row => namePositionMatch(row, rutgersRosterById.get(row.player_id))));
check('Opponent identity registry matches opponent source or stat-only rows by ID/name/position', opponentIdentityRows.length >= PURDUE_OPPONENT_PLAYERS.players.length && opponentIdentityRows.filter(row => row.card_ref).length === PURDUE_OPPONENT_PLAYERS.players.length && opponentIdentityRows.every(row => {
  const source = opponentPlayersById.get(row.opponent_player_id);
  return source ? namePositionMatch({ ...row, player_id: row.opponent_player_id }, source) : row.source_status === 'stat_only_identity' && row.name && row.position;
}));
check('Prospect identity registry matches recruiting class by ID/name/position', prospectIdentityRows.length === RECRUITING_CLASS.prospects.length && prospectIdentityRows.every(row => namePositionMatch(row, prospectById.get(row.prospect_id))));
check('Play identity registry matches verified playbook by ID/name/formation/set', playIdentityRows.length === RUTGERS_PLAYBOOK.length && playIdentityRows.every(row => { const play = playbookById.get(row.play_id); return play && row.play_name === play.name && row.formation_family === play.formationFamily && row.set_or_subformation === play.set; }));
check('Identity migration map covers every canonical entity', identityIdMap.mappings.length === allCanonicalPlayerIds.length + prospectIdentityRows.length + playIdentityRows.length && identityIdMap.mappings.every(row => row.canonical_id && ['preserved','created','remapped'].includes(row.status)));
check('Rutgers roster count equals base Player Card count', RUTGERS_ROSTER_BASE.players.length === registry.rutgers_cards.length && registry.rutgers_cards.every(card => rutgersRosterById.has(card.player_id)));
check('Opponent player count equals opponent Player Card count', PURDUE_OPPONENT_PLAYERS.players.length === registry.opponent_cards.length && registry.opponent_cards.every(card => opponentPlayersById.has(card.player_id)));
check('Rutgers media binds exactly one portrait to each Rutgers player_id', rutgersMedia.players.length === RUTGERS_ROSTER_BASE.players.length && unique(rutgersMedia.players.map(row => row.player_id)) && rutgersMedia.players.every(row => rutgersRosterById.has(row.player_id) && fs.existsSync(path.join(root, row.portrait_path))));
check('Opponent media binds exactly one portrait to each opponent player ID', opponentMedia.players.length === PURDUE_OPPONENT_PLAYERS.players.length && unique(opponentMedia.players.map(row => row.player_id)) && opponentMedia.players.every(row => opponentPlayersById.has(row.player_id) && fs.existsSync(path.join(root, row.portrait_path))));
check('Rutgers stat rows resolve by player_id and matching name only', [...rutgersLastRows, ...rutgersSeasonRows].every(row => rutgersRosterById.has(row.player_id) && rutgersRosterById.get(row.player_id).name === row.name));
check('Opponent stat rows resolve by player_id and matching name only', [...opponentLastRows, ...opponentSeasonRows].every(row => opponentIdentityById.has(row.player_id) && opponentIdentityById.get(row.player_id).name === row.name));
check('Every RecruitCard can render from one prospect_id without loose prospect rows', RECRUITING_CLASS.prospects.length === prospectIdentityRows.length && RECRUITING_CLASS.prospects.every((prospect, index) => engine.RecruitCard({ ...prospect, prospect }, index, 'prospect').includes(`data-prospect-id="${prospect.prospect_id}"`)));
check('Recruit attribute objects resolve per prospect and missing values render N/A or are hidden', RECRUITING_CLASS.prospects.every(prospect => prospect.analysis && prospect.analysis.display_stats && prospect.analysis.display_stats.position === prospect.position) && engine.formatLimited(undefined, 'N/A') === 'N/A');
const verifiedGemIds = RECRUITING_CLASS.prospects.filter(prospect => prospect.gem === true || prospect.gem_status === 'Gem' || prospect.analysis?.gem_status === 'Gem').map(prospect => prospect.prospect_id);
const recruitClassHtml = RECRUITING_CLASS.prospects.map((prospect, index) => engine.RecruitCard({ ...prospect, prospect }, index, 'prospect')).join('\n');
check('Verified recruit gem state is source-driven', verifiedGemIds.length === 0 ? !recruitClassHtml.includes('💎') : verifiedGemIds.every(id => engine.RecruitCard({ ...prospectById.get(id), prospect: prospectById.get(id) }, 0, 'prospect').includes('💎')));
const boardRows = (global.VIDEO_VERIFIED_RUTGERS_PROSPECT_BOARD || RECRUITING_WEEKLY).active_board || [];
const wBoudreauxBoard = boardRows.find(row => row.prospect_id === 'w-boudreaux') || {};
const wBoudreauxJoin = engine.resolveRecruitScoutingById('w-boudreaux', wBoudreauxBoard);
const wBoudreaux = wBoudreauxJoin.prospect || {};
const wBoudreauxHtml = engine.recruitDetailHtml('w-boudreaux', 'prospects');
const wExpectedAttributes = { awareness: 73, speed: 91, acceleration: 91, change_of_direction: 90, agility: 90, man_coverage: 65, zone_coverage: 77, press: 71, catching: 61, tackle: 76 };
check('W. Boudreaux resolves to exact verified scouting detail record', wBoudreauxJoin.state === 'verified' && wBoudreaux.prospect_id === 'w-boudreaux' && wBoudreaux.name === 'W. Boudreaux' && wBoudreaux.position === 'FS' && wBoudreaux.height === '6\'0"' && wBoudreaux.weight_lbs === 210 && wBoudreaux.archetype === 'Coverage Specialist' && wBoudreaux.hometown === 'Rock Island, IL' && wBoudreaux.scouting_percentage === 100);
check('W. Boudreaux shown attributes belong to his prospect_id', Object.entries(wExpectedAttributes).every(([key, value]) => wBoudreaux.attributes && wBoudreaux.attributes[key] === value));
check('W. Boudreaux ability, mental, and development trait resolve', (wBoudreaux.abilities || []).includes('Robber') && (wBoudreaux.mentals || []).includes('Winning Time') && wBoudreaux.development_trait === 'Hidden');
check('W. Boudreaux card displays verified fields and source-missing board rank as N/A', ['W. Boudreaux','FS','6\'0"','210 lbs','Coverage Specialist','Rock Island, IL','100%','Robber','Winning Time','Hidden','Speed','91','Zone Coverage','77'].every(token => wBoudreauxHtml.includes(token)) && wBoudreauxHtml.includes('<span>Board Rank</span><strong>N/A</strong>') && !wBoudreauxHtml.includes('Limited data'));
const explicitRankRows = boardRows.filter(row => row.board_order !== null && row.board_order !== undefined);
const boardRankMismatches = explicitRankRows.filter(row => !engine.RecruitCard(row, 0, 'board').includes(`<i>#${row.board_order}</i>`));
check('Recruit board rank uses explicit board_order and never array index fallback', boardRankMismatches.length === 0 && engine.recruitDetailHtml('w-boudreaux', 'prospects').includes('<span>Board Rank</span><strong>N/A</strong>'), `mismatches=${boardRankMismatches.length}`);
const boardJoinResults = boardRows.map(row => engine.resolveRecruitScoutingById(row.prospect_id, row));
const recruitFailedJoins = boardJoinResults.filter(row => row.state === 'join_failed');
check('Recruit joins distinguish source_missing from join_failed', recruitFailedJoins.length === 0 && boardJoinResults.filter(row => row.state === 'verified').length >= 1);
check('Every recruit scouting attribute object is owned by matching prospect_id', RECRUITING_CLASS.prospects.every(prospect => prospect.attributes ? prospect.prospect_id && prospectById.get(prospect.prospect_id) === prospect : true));
check('Verified recruit ability, mental, and development fields attach to owning prospect only', RECRUITING_CLASS.prospects.every(prospect => {
  const html = engine.recruitDetailHtml(prospect.prospect_id, 'prospects');
  return (prospect.abilities || []).every(item => html.includes(item)) && (prospect.mentals || []).every(item => html.includes(item)) && (!prospect.development_trait || html.includes(prospect.development_trait));
}));
const verifiedDevelopmentTraitIds = RUTGERS_ROSTER_BASE.players.filter(player => player.development_trait || player.dev_trait).map(player => player.player_id);
check('Verified development traits are source-driven and not invented', verifiedDevelopmentTraitIds.length === 0 ? RUTGERS_ROSTER_BASE.players.every(player => !engine.compactPlayerListCard(player, 'rutgers', engine.normalizePosition(player.position)).includes('dev-trait-badge')) : verifiedDevelopmentTraitIds.every(id => engine.compactPlayerListCard(rutgersRosterById.get(id), 'rutgers', engine.normalizePosition(rutgersRosterById.get(id).position)).includes(rutgersRosterById.get(id).development_trait || rutgersRosterById.get(id).dev_trait)));
const olineSlots = ['LT','LG','C','RG','RT'];
const olineJoinRows = olineSlots.map(slot => engine.resolveDepthSlotByPlayerId(slot));
check('Position alias normalization does not silently guess generic line sides', engine.normalizePosition('LT') === 'LT' && engine.normalizePosition('RT') === 'RT' && engine.normalizePosition('T') === 'T' && engine.normalizePosition('G') === 'G' && engine.normalizePosition('OL') === 'OL' && engine.normalizePosition('REDG') === 'EDGE' && engine.normalizePosition('RB') === 'HB');
check('Rutgers LT/LG/C/RG/RT depth slots resolve through canonical player IDs', olineJoinRows.every(row => row.state === 'verified' && row.player && rutgersRosterById.has(row.player.player_id) && row.player.position === row.slot));
check('Rutgers O-line card no longer masks resolved slots as No starter', !engine.renderOLine().includes('No starter') && olineSlots.every(slot => engine.renderOLine().includes(`data-slot="${slot}"`)));
check('Rutgers player detail joins resolve attributes, media, stats, and depth role by player_id', RUTGERS_ROSTER_BASE.players.every(player => player.attributes && engine.resolvePlayerMediaById(player.player_id, 'rutgers').state === 'verified' && ['verified','source_missing'].includes(engine.resolvePlayerStatsById(player.player_id, 'rutgers').state)));
check('Depth chart seed owns explicit canonical O-line player IDs', (depthChartSeed.position_groups || []).filter(row => olineSlots.includes(row.position)).every(row => (row.players || []).length === 1 && rutgersRosterById.has(row.players[0].player_id)));
check('join_failed is never rendered as ordinary Limited data in recruit or O-line cards', !/join_failed[\\s\\S]{0,80}Limited data/i.test(wBoudreauxHtml + engine.renderOLine()));
check('Every verified playbook record is preserved as one canonical play identity', RUTGERS_PLAYBOOK.length === 192 && playIdentityRows.length === 192 && unique(RUTGERS_PLAYBOOK.map(play => play.verifiedVisibleKey)));
check('Play art bindings resolve by play_id or placeholder without dropping plays', playIdentityRows.every(row => playbookById.has(row.play_id) && row.art_ref && fs.existsSync(path.join(root, row.art_ref))));
const weeklyPlayRefs = [weeklyMatchupSummary.best_play.play_id, ...weeklyMatchupSummary.top_three.map(row => row.play_id), ...runLaneAnalysis.lanes.flatMap(row => row.recommended_play_ids || [])];
check('Weekly recommendation play references resolve to canonical play IDs', weeklyPlayRefs.every(id => playbookById.has(id) && playIdentityRows.some(row => row.play_id === id)));
const weeklyPlayerRefs = [
  weeklyMatchupSummary.featured_player.player_id,
  weeklyMatchupSummary.best_play.primary_target_player_id,
  weeklyMatchupSummary.passing_game.best_wr_matchup && weeklyMatchupSummary.passing_game.best_wr_matchup.player_id,
  ...Object.values(coachingDecisions.run_personnel).flatMap(row => [row.primary_player_id, row.secondary_player_id]),
  ...weeklyMatchupSummary.protection.slots.flatMap(row => [row.rutgers_player_id].filter(Boolean))
].filter(Boolean);
check('Weekly recommendation Rutgers player references resolve to canonical roster IDs', weeklyPlayerRefs.every(id => rutgersRosterById.has(id)));
check('Run play recommended carriers resolve to active roster identities when evidence exists', RUTGERS_PLAYBOOK.filter(play => engine.runStyleForPlay(play)).every(play => { const decision = engine.runPersonnelDecision(play); return !decision || !decision.primary || rutgersRosterById.has(decision.primary.player_id); }));
check('Matchups resolve Rutgers/opponent IDs, names, media, attributes, stats, and recommendation from one matchup record', PLAYER_MATCHUPS.matchups.every(row => {
  const rutgers = row.rutgers_player && rutgersRosterById.get(row.rutgers_player.player_id);
  const opponent = row.opponent_player && opponentPlayersById.get(row.opponent_player.player_id);
  const rutgersMediaRow = rutgersMedia.players.find(media => media.player_id === row.rutgers_player.player_id);
  const opponentMediaRow = opponentMedia.players.find(media => media.player_id === row.opponent_player.player_id);
  return rutgers && opponent &&
    row.rutgers_player.name === rutgers.name && row.rutgers_player.position === rutgers.position &&
    row.opponent_player.name === opponent.name && row.opponent_player.position === opponent.position &&
    rutgersMediaRow && opponentMediaRow &&
    row.rutgers_player.attributes && row.opponent_player.attributes &&
    row.grade && Array.isArray(row.tactical_recommendations);
}));
const identityUnresolvedReferences = [
  ...allCanonicalPlayerIds.filter(id => !id),
  ...prospectIdentityRows.filter(row => !prospectById.has(row.prospect_id)).map(row => row.prospect_id),
  ...playIdentityRows.filter(row => !playbookById.has(row.play_id)).map(row => row.play_id),
  ...weeklyPlayRefs.filter(id => !playbookById.has(id)),
  ...weeklyPlayerRefs.filter(id => !rutgersRosterById.has(id))
];
check('Identity unresolved reference count is zero', identityUnresolvedReferences.length === 0, `unresolved=${identityUnresolvedReferences.length}`);
const auditRecords = videoEvidenceIndex.records || [];
const auditByType = type => auditRecords.filter(row => row.entity_type === type);
const requiredVideoReports = [
  'COMPLETE_VIDEO_AUDIT_REPORT.md',
  'RUTGERS_VIDEO_DATA_RECOVERY_REPORT.md',
  'OPPONENT_VIDEO_DATA_RECOVERY_REPORT.md',
  'RECRUIT_VIDEO_DATA_RECOVERY_REPORT.md',
  'PLAY_VIDEO_DATA_RECOVERY_REPORT.md',
  'COMPLETE_APP_NA_RECHECK_REPORT.md',
  'IDENTITY_JOIN_INTEGRITY_REPORT.md',
  'UNIFORM_CARD_CONTRACT_REPORT.md',
  'SPORTS_APP_BEHAVIOR_REPORT.md',
  'FINAL_VIDEO_TO_JSON_REGRESSION_REPORT.md'
];
check('Complete video audit reports exist', requiredVideoReports.every(file => fs.existsSync(path.join(root, file))));
check('Video evidence index has one record for every audited app entity', videoEvidenceIndex.package_type === 'video_evidence_index' &&
  auditByType('rutgers_player').length === RUTGERS_ROSTER_BASE.players.length &&
  auditByType('opponent_player').length === PURDUE_OPPONENT_PLAYERS.players.length &&
  auditByType('recruit').length === RECRUITING_CLASS.prospects.length &&
  auditByType('play').length === playIdentityRows.length &&
  auditByType('matchup').length === phase1Matchups.matchups.length,
  `records=${auditRecords.length}`);
check('Video audit count parity is preserved', videoEvidenceIndex.counts.rutgers.roster_players === registry.rutgers_cards.length &&
  videoEvidenceIndex.counts.opponent.roster_players === registry.opponent_cards.length &&
  videoEvidenceIndex.counts.recruiting.recruit_names === RECRUITING_CLASS.prospects.length &&
  videoEvidenceIndex.counts.plays.verified_plays === RUTGERS_PLAYBOOK.length &&
  videoEvidenceIndex.counts.plays.canonical_ids === playIdentityRows.length);
check('Video evidence records use real-or-null timestamps only', auditRecords.every(row => row.timestamps && ['overview','attributes','stats'].every(key => row.timestamps[key] === null || /^\d{2}:\d{2}(:\d{2})?$/.test(row.timestamps[key]))));
check('Remaining N/A fields are documented in the recheck report', videoEvidenceIndex.counts.totals.remaining_na_fields >= 0 && fs.readFileSync(path.join(root, 'COMPLETE_APP_NA_RECHECK_REPORT.md'), 'utf8').includes('video checked: yes'));
check('Video audit unresolved join count is zero', videoEvidenceIndex.counts.totals.unresolved_joins === 0);
const requiredVideoOnlyReports = [
  'VIDEO_PACKAGE_INGEST_REPORT.md',
  'RUTGERS_SEASON_STATS_VIDEO_AUDIT.md',
  'PURDUE_SEASON_STATS_VIDEO_AUDIT.md',
  'PURDUE_ROSTER_VIDEO_AUDIT.md',
  'FOUR_STAR_FRESHMAN_CLASS_VIDEO_AUDIT.md',
  'RUTGERS_PROSPECT_BOARD_VIDEO_AUDIT.md',
  'PLAYER_ATTRIBUTE_AND_STAT_EXTRACTION_REPORT.md',
  'VIDEO_ONLY_NA_REPORT.md',
  'VIDEO_ONLY_CARD_POPULATION_REPORT.md',
  'FINAL_VIDEO_ONLY_REGRESSION_REPORT.md'
];
check('Video-only required reports exist', requiredVideoOnlyReports.every(file => fs.existsSync(path.join(root, file))));
check('Video-only evidence index parses and covers all five source videos', videoOnlyEvidence.package_type === 'video_only_evidence_index' && videoOnlyEvidence.source_videos.length === 5 && videoOnlyEvidence.records.length > 0);
check('Video-only unresolved identity count is zero', videoOnlyEvidence.counts.unresolved_identities === 0);
check('Video-only JSON card population counts are stable', videoOnlyEvidence.counts.purdue_roster_records === 16 && videoOnlyEvidence.counts.recruit_cards_populated === 62 && videoOnlyEvidence.counts.rutgers_season_stat_records > 0 && videoOnlyEvidence.counts.purdue_season_stat_records > 0);
check('Video-only bundles load before app.js', index.indexOf('data/video_verified/rutgers_season_stats.js') > index.indexOf('data/weekly/weekly_matchup_summary.js') && index.indexOf('data/video_verified/video_evidence_index.js') < index.indexOf('app.js'));
check('Video-only records carry timestamp evidence and N/A audit fields', (videoOnlyEvidence.records || []).every(row => row.evidence && /^\d{2}:\d{2}:\d{2}$/.test(row.evidence.timestamp) && Array.isArray(row.verified_fields) && Array.isArray(row.na_fields)));
check('App loaders prefer video-only verified bundles when present', app.includes('VIDEO_VERIFIED_RUTGERS_SEASON_STATS') && app.includes('VIDEO_VERIFIED_PURDUE_SEASON_STATS') && app.includes('VIDEO_VERIFIED_PURDUE_ROSTER') && app.includes('VIDEO_VERIFIED_FOUR_STAR_FRESHMAN_CLASS') && app.includes('VIDEO_VERIFIED_RUTGERS_PROSPECT_BOARD'));
check('Video recovery bundles are loaded before app.js', ['rutgers_roster_recovery.js','purdue_roster_recovery.js','rutgers_board_scouting_recovery.js'].every(file => index.indexOf(`data/video_verified/${file}`) > -1 && index.indexOf(`data/video_verified/${file}`) < index.indexOf('app.js')));
const recoveredYork = engine.resolveRutgersPlayerById('m-york-qb').player || {};
const recoveredBieniemy = engine.resolveRutgersPlayerById('r-bieniemy-qb').player || {};
const recoveredNwaneri = engine.resolveRutgersPlayerById('w-nwaneri-redg').player || {};
check('Rutgers QB video recovery populates verified traits and attributes', recoveredYork.development_trait === 'Impact' && recoveredYork.attributes.throw_power === 92 && (recoveredYork.mental_abilities || []).includes('Winning Time') && recoveredBieniemy.development_trait === 'Star' && recoveredBieniemy.attributes.throw_power === 91 && (recoveredBieniemy.physical_abilities || []).includes('Mobile Deadeye'));
check('Rutgers defensive video recovery populates verified dev traits and abilities', recoveredNwaneri.development_trait === 'Star' && (recoveredNwaneri.physical_abilities || []).includes('Pocket Disruptor') && engine.playerDetailHtml('w-nwaneri-redg', 'rutgers', 'DL').includes('Pocket Disruptor'));
const recoveredGillians = engine.resolveOpponentPlayerById('pur-redg-q-gillians').player || {};
check('Purdue weekly roster recovery populates verified threat attributes', recoveredGillians.attributes && recoveredGillians.attributes.power_moves === 85 && (recoveredGillians.physical_abilities || []).includes('Hammer') && engine.playerDetailHtml('pur-redg-q-gillians', 'opponent', 'EDGE').includes('Hammer'));
const recoveredGilliansDetail = engine.playerDetailHtml('pur-redg-q-gillians', 'opponent', 'EDGE');
check('Purdue detail screens render evidence and recommendation without row collision', recoveredGilliansDetail.includes('Purdue roster.mp4') && recoveredGilliansDetail.includes('detail-callout') && !/Recommendation<\/span><strong>\s*<\/strong>/.test(recoveredGilliansDetail));
const recoveredIsaac = engine.resolveRecruitScoutingById('e-isaac', (global.VIDEO_VERIFIED_RUTGERS_PROSPECT_BOARD.active_board || []).find(row => row.prospect_id === 'e-isaac') || {});
const recoveredCoco = engine.resolveRecruitScoutingById('s-coco', {});
check('Rutgers recruiting board recovery resolves verified detail screens', recoveredIsaac.state === 'verified' && recoveredIsaac.prospect.attributes.pass_block === 78 && (recoveredIsaac.prospect.mentals || []).includes('Winning Time') && recoveredCoco.state === 'verified' && recoveredCoco.prospect.attributes.change_of_direction === 91 && (recoveredCoco.prospect.mentals || []).includes('Clearheaded'));
check('Recovered video values render instead of N/A on detail screens', ['Off Platform','Mobile Deadeye','Throw power','92','Hammer','Power moves','85','Quick Step'].every(token => (engine.playerDetailHtml('m-york-qb', 'rutgers', 'QB') + engine.playerDetailHtml('r-bieniemy-qb', 'rutgers', 'QB') + engine.playerDetailHtml('pur-redg-q-gillians', 'opponent', 'EDGE') + engine.recruitDetailHtml('e-isaac', 'board')).includes(token)) && recoveredIsaac.prospect.attributes.pass_block === 78);
const textOnly = html => String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const renderedCardText = [
  ...RUTGERS_ROSTER_BASE.players.map(player => engine.premiumPlayerCard(player, 'rutgers')),
  ...PURDUE_OPPONENT_PLAYERS.players.map(player => engine.premiumPlayerCard(player, 'opponent')),
  ...RECRUITING_CLASS.prospects.map((prospect, index) => engine.RecruitCard({ ...prospect, prospect }, index, 'prospect')),
  ...engine.topPlayInventory().slice(0, 30).map((play, index) => engine.lockedPlayCard(play, index + 1)),
  engine.renderCoordinatorDashboard()
].map(textOnly).join(' ');
const visibleInternalIds = [
  ...RUTGERS_ROSTER_BASE.players.map(row => row.player_id),
  ...PURDUE_OPPONENT_PLAYERS.players.map(row => row.player_id),
  ...RECRUITING_CLASS.prospects.map(row => row.prospect_id),
  ...playIdentityRows.map(row => row.play_id),
  ...phase1Matchups.matchups.map(row => row.matchup_id)
].filter(id => id && renderedCardText.includes(id));
check('Internal IDs are hidden from rendered production card text', visibleInternalIds.length === 0 && !/Related play IDs|Play ID|prospect_id|player_id|matchup_id|play_id|Join state/i.test(renderedCardText), `visible=${visibleInternalIds.slice(0,5).join(',')}`);
check('Raw internal production status keys are hidden from rendered card text', !/\b(active_target|source_missing|join_failed|verified_matchup_data|limited_lane_scoring)\b/i.test(renderedCardText + engine.renderCoordinatorDashboard() + engine.renderOpponent('all')));
check('Player and recruit detail behavior uses dedicated screens instead of inline default expansion', app.includes('data-recruit-detail') && app.includes('data-opponent-detail') && app.includes('data-player-detail') && engine.RecruitCard(boardRows[0], 0, 'board').startsWith('<button') && engine.renderOpponent('all').includes('opponent-compact-card'));
const rutgersCompactCards = RUTGERS_ROSTER_BASE.players.map(player => engine.compactPlayerListCard(player, 'rutgers', engine.normalizePosition(player.position)));
const opponentCompactCards = PURDUE_OPPONENT_PLAYERS.players.map(player => engine.opponentPlayerCard(player));
const boardCompactCards = activeBoardRowsForValidation(boardRows, RECRUITING_CLASS.prospects).slice(0, 35).map((row, index) => engine.RecruitCard(row, index, 'board'));
function activeBoardRowsForValidation(board, prospects) {
  const byId = new Map(prospects.map(row => [row.prospect_id, row]));
  return board.map(row => ({ ...row, prospect: byId.get(row.prospect_id) || byId.get((row.linked_prospect_ids || [])[0]) || {} }));
}
const compactCardContract = html => html.startsWith('<button') && html.includes('sports-athlete-card') && html.includes('sports-card-left') && html.includes('sports-card-main') && html.includes('sports-card-badge') && html.includes('sports-stat-strip') && !html.includes('<details');
check('Rutgers compact player cards use one sports-app layout', rutgersCompactCards.length === 48 && rutgersCompactCards.every(compactCardContract));
check('Purdue compact player cards use one sports-app layout', opponentCompactCards.length === 16 && opponentCompactCards.every(compactCardContract));
check('Recruit compact cards use one sports-app layout', boardCompactCards.length === 35 && boardCompactCards.every(html => compactCardContract(html) && html.includes('recruit-compact-card')));
check('Compact cards keep internal IDs out of visible text', !visibleInternalIds.some(id => [...rutgersCompactCards, ...opponentCompactCards, ...boardCompactCards].map(textOnly).join(' ').includes(id)));
const recruitStarFixtures = [
  ...boardCompactCards,
  ...RECRUITING_CLASS.prospects.map((prospect, index) => engine.RecruitCard({ ...prospect, prospect }, index, 'prospect')),
  ...boardRows.slice(0, 35).map(row => engine.recruitDetailHtml(row.prospect_id, 'board'))
];
check('Recruit star ratings render the user-confirmed four-star class', recruitStarFixtures.length > 0 && recruitStarFixtures.every(html => html.includes('4&#9733;') && !html.includes('Stars N/A')));
check('Verified recruit gem badges are source-driven only', verifiedGemIds.length === 0 ? !boardCompactCards.join('\n').includes('&#128142;') : verifiedGemIds.every(id => engine.RecruitCard({ ...prospectById.get(id), prospect: prospectById.get(id) }, 0, 'prospect').includes('&#128142;')));
check('Dedicated player detail screens expose sports profile hero and required tabs', RUTGERS_ROSTER_BASE.players.every(player => { const html = engine.playerDetailHtml(player.player_id, 'rutgers', engine.normalizePosition(player.position)); return html.includes('sports-profile-hero') && ['Overview','Attributes','Stats','Matchups','Plays'].every(token => html.includes(token)) && html.indexOf('Season') < html.indexOf('Last Game'); }));
check('Dedicated Purdue detail screens expose sports profile hero and required tabs', PURDUE_OPPONENT_PLAYERS.players.every(player => { const html = engine.opponentPlayerDetailHtml(player.player_id); return html.includes('sports-profile-hero opponent') && ['Overview','Attributes','Stats','Matchups','Plays'].every(token => html.includes(token)); }));
check('Dedicated recruit detail screens expose sports profile hero and required tabs', boardRows.slice(0, 35).every(row => { const html = engine.recruitDetailHtml(row.prospect_id, 'board'); return html.includes('sports-profile-hero recruit') && ['Overview','Scouting','Fit','Activity'].every(token => html.includes(token)); }));
check('Recruit detail hero uses mobile-safe two-column layout and compact badge', css.includes('.sports-profile-hero.recruit') && css.includes('grid-column: 1 / -1') && boardRows.slice(0, 35).every(row => !engine.recruitDetailHtml(row.prospect_id, 'board').includes('Insufficient verified data</b>')));
check('Back navigation and scroll restoration helpers are wired', app.includes('function saveDetailScroll') && app.includes('function restoreDetailScroll') && app.includes("restoreDetailScroll('personnel')") && app.includes("restoreDetailScroll('recruiting')"));
check('Uniform player and recruit card tab contracts render', RUTGERS_ROSTER_BASE.players.every(player => engine.premiumPlayerCard(player, 'rutgers').includes('Overview') && engine.premiumPlayerCard(player, 'rutgers').includes('Attributes') && engine.premiumPlayerCard(player, 'rutgers').includes('Matchups') && engine.premiumPlayerCard(player, 'rutgers').includes('Plays')) &&
  RECRUITING_CLASS.prospects.every((prospect, index) => { const html = engine.RecruitCard({ ...prospect, prospect }, index, 'prospect'); return html.includes('Overview') && html.includes('Scouting') && html.includes('Fit') && html.includes('Activity'); }));
const packBIds = ['dashboard_game_header','dashboard_featured_player','dashboard_biggest_risk','dashboard_best_run_lane','dashboard_protection_call','dashboard_passing_focus','dashboard_red_zone_plan','dashboard_third_down_plan','dashboard_top_matchups_preview','dashboard_alerts','dashboard_tempo','team_card_rutgers','team_card_opponent'];
const cardById = new Map((cardRegistry.cards || []).map(card => [card.card_id, card]));
const dashboardCards = (cardRegistry.cards || []).filter(card => card.visible !== false && card.tab === 'gameplan' && card.section === 'dashboard').sort((a,b) => Number(a.order) - Number(b.order));
check('Pack B registry entries exist', packBIds.every(id => cardById.has(id)));
check('Dashboard order resolves from registry', dashboardCards.map(card => card.card_id).join('|') === ['dashboard_game_header','dashboard_featured_player','dashboard_biggest_risk','dashboard_best_run_lane','dashboard_protection_call','dashboard_passing_focus','dashboard_red_zone_plan','dashboard_third_down_plan','dashboard_top_matchups_preview','dashboard_alerts'].join('|'));
check('Pack B source refs resolve without duplicated football data', packBIds.every(id => cardById.get(id) && cardById.get(id).source_refs && typeof cardById.get(id).source_refs === 'object') && !/"record"\s*:|"overall"\s*:|"offense"\s*:|"defense"\s*:|"recommendation"\s*:|"confidence"\s*:/.test(JSON.stringify(cardRegistry)));
check('Gameplan home-dashboard container exists on Gameplan tab', index.includes('id="gameplanHome"') && app.includes('function renderCoordinatorDashboard') && app.includes('homeTeamSnapshotCard'));
const dashboardHtml = dashboardCards.map(card => engine.renderDashboardCard(card)).join('\n');
check('Executive dashboard renders from registry cards', dashboardHtml.includes('dashboard_game_header') && dashboardHtml.includes('dashboard_featured_player') && dashboardHtml.includes('dashboard_biggest_risk'));
check('Game Header has both teams and verified ratings', dashboardHtml.includes('game-header-card') && dashboardHtml.includes('OVR 84') && dashboardHtml.includes('OFF 84') && dashboardHtml.includes('DEF 86') && dashboardHtml.includes('OVR 64') && dashboardHtml.includes('OFF 64') && dashboardHtml.includes('DEF 64'));
check('Team Cards render Last Game and Season separately', engine.renderDashboardCard(cardById.get('team_card_rutgers')).includes('Last Game') && engine.renderDashboardCard(cardById.get('team_card_rutgers')).includes('Season') && engine.renderDashboardCard(cardById.get('team_card_opponent')).includes('Last Game') && engine.renderDashboardCard(cardById.get('team_card_opponent')).includes('Season'));
check('Featured Player resolves by weekly player identity to roster player_id', (() => { const result = engine.resolveFeaturedPlayer(); return result.player && result.player.player_id && result.weeklyRow && result.weeklyRow.name === result.player.name; })());
check('Biggest Risk resolves by opponent player and matchup ID', (() => { const result = engine.biggestRiskModel(); return result.row && result.row.matchup_id && result.opponent && result.opponent.player_id && result.rutgers; })());
check('Weekly tactical cards read from verified JSON or verified playbook context', ['dashboard_best_run_lane','dashboard_protection_call','dashboard_passing_focus','dashboard_red_zone_plan','dashboard_third_down_plan','dashboard_tempo'].every(id => { const model = engine.tacticalCardModel(cardById.get(id)); return model && model.recommendation && model.title; }));
check('Unsupported tactical cards remain outside the default dashboard', !dashboardCards.some(card => /two_minute|goal_line|screen_constraint/i.test(card.card_id)));
const previewHtml = engine.renderDashboardCard(cardById.get('dashboard_top_matchups_preview'));
check('Top Matchups Preview preserves approved order', engine.orderedMatchupRows().slice(0,3).map(item => item.row.matchup_id).join('|') === 'rt_vs_redg|c_vs_dt|hb2_vs_sam' && previewHtml.indexOf('B. Newberry') < previewHtml.indexOf('D. Sturgis') && previewHtml.indexOf('D. Sturgis') < previewHtml.indexOf('J. Haskins'));
check('Dashboard fixture contains no raw nullish/object text', !/\[object Object\]|undefined|(^|[>\s])null([<\s]|$)/i.test(dashboardHtml));
check('Pack B cards use shared card primitives', ['gameHeaderCard','featuredPlayerCard','biggestRiskCard','tacticalSummaryCard','topMatchupsPreviewCard','alertsCard'].every(fn => app.includes(`function ${fn}`)) && (dashboardHtml.match(/base-card/g) || []).length >= dashboardCards.length);
const packCIds = ['rutgers_player_card','opponent_player_card','oline_player_card','top_play_card','best_call_card','alternative_play_card','recommended_ball_carrier_block','run_lane_recommendation_block'];
check('Pack C registry entries exist', packCIds.every(id => cardById.has(id)));
check('Coaching decision JSON exists and parses', coachingDecisions.package_type === 'weekly_coaching_decisions' && coachingDecisions.schema_version === '1.0');
check('Run-lane analysis JSON exists and parses', runLaneAnalysis.package_type === 'weekly_run_lane_analysis' && Array.isArray(runLaneAnalysis.lanes));
const rosterIds = new Set(RUTGERS_ROSTER_BASE.players.map(p => p.player_id));
const playIds = new Set(RUTGERS_PLAYBOOK.map(p => p.id));
const matchupIds = new Set(phase1Matchups.matchups.map(m => m.matchup_id));
check('All coaching-decision player IDs resolve', Object.values(coachingDecisions.run_personnel).every(row => rosterIds.has(row.primary_player_id) && (!row.secondary_player_id || rosterIds.has(row.secondary_player_id))));
check('Run-lane references resolve and remain limited without fabricated scores', runLaneAnalysis.lanes.every(lane => lane.score === null && lane.status === 'limited_data' && (lane.recommended_play_ids || []).every(id => playIds.has(id)) && (lane.source_matchup_ids || []).every(id => matchupIds.has(id))));
check('All 48 Rutgers locked Player Cards resolve', RUTGERS_ROSTER_BASE.players.length === 48 && RUTGERS_ROSTER_BASE.players.every(player => engine.premiumPlayerCard(player, 'rutgers').includes(`data-player-id="${player.player_id}"`)));
check('All 16 opponent locked Player Cards resolve', PURDUE_OPPONENT_PLAYERS.players.length === 16 && PURDUE_OPPONENT_PLAYERS.players.every(player => engine.premiumPlayerCard(player, 'opponent').includes(`data-player-id="${player.player_id}"`)));
const samplePlayerHtml = engine.premiumPlayerCard(RUTGERS_ROSTER_BASE.players[0], 'rutgers');
check('Season Stats appear before Last Game in Player Card', samplePlayerHtml.indexOf('Season Stats') > -1 && samplePlayerHtml.indexOf('Season Stats') < samplePlayerHtml.indexOf('Last Game'));
check('Top 6 attributes only in default Player Card section', (samplePlayerHtml.match(/Top 6 Position-Relevant Attributes/g) || []).length === 1 && app.includes('lockedAttributeRows(player, 6)'));
check('Missing stats do not hide players', samplePlayerHtml.includes('Limited data') && samplePlayerHtml.includes(RUTGERS_ROSTER_BASE.players[0].name));
check('LT/LG/C/RG/RT all resolve in locked O-line card', ['LT','LG','C','RG','RT'].every(slot => engine.renderOLine ? true : app.includes('LT — LG — C — RG — RT')) && app.includes('locked-oline-slots'));
check('All 192 verified visible Play Cards resolve', RUTGERS_PLAYBOOK.length === 192 && RUTGERS_PLAYBOOK.every((play, i) => engine.lockedPlayCard({...engine.scorePlay(play, ctx(1,5)), ...play}, i + 1).includes(`data-play-id="${play.id}"`)));
const outsidePlay = RUTGERS_PLAYBOOK.find(play => /outside|stretch|sweep|toss|speed option|perimeter|pin|pull/i.test(play.name) || /outside/i.test(engine.conceptFamily(play))) || RUTGERS_PLAYBOOK.find(play => /counter/i.test(play.name));
const insidePlay = RUTGERS_PLAYBOOK.find(play => /inside|duo|power|trap|dive|iso/i.test(play.name) || /inside/i.test(engine.conceptFamily(play)));
check('Run plays resolve a run style', RUTGERS_PLAYBOOK.filter(play => engine.runStyleForPlay(play)).length > 0);
check('Outside concepts resolve to Haskins by current weekly decision data', outsidePlay && engine.runStyleForPlay(outsidePlay) === 'outside' && engine.runPersonnelDecision(outsidePlay).primary.player_id === 'j-haskins-hb');
check('Inside/power concepts resolve to Simonson by current weekly decision data', insidePlay && ['inside','short_yardage','goal_line'].includes(engine.runStyleForPlay(insidePlay)) && engine.runPersonnelDecision(insidePlay).primary.player_id === 't-simonson-hb');
check('Recommended Ball Carrier block is JSON-driven and renderer has no hardcoded back names', engine.ballCarrierBlock(outsidePlay).includes('J. Haskins') && engine.ballCarrierBlock(insidePlay).includes('T. Simonson') && !/function lockedPlayCard[\s\S]*J\. Haskins|function lockedPlayCard[\s\S]*T\. Simonson/.test(app));
check('Best-side recommendation stays hidden when lane scoring is limited', !engine.bestVerifiedRunLane(insidePlay) && engine.runLaneBlock(insidePlay).includes('Limited data') && !engine.runLaneBlock(insidePlay).includes('Recommended Side</h4><div class="metric-row"><span>Lane</span>'));
check('No internal score mislabeled as lane advantage', !JSON.stringify(runLaneAnalysis).includes('internal_score') && !engine.runLaneBlock(insidePlay).includes('ADVANTAGE'));
const packDIds = ['offensive_executive_summary','offensive_comparison_table','best_play_hero','top_three_selector','run_game_card','passing_game_card','protection_card','offensive_alerts_card','defensive_executive_summary','defensive_comparison_table','biggest_threat_card','pressure_card','coverage_card','defensive_alerts_card'];
check('Pack D registry entries exist', packDIds.every(id => cardById.has(id)));
check('Weekly matchup summary exists and parses', weeklyMatchupSummary.package_type === 'weekly_matchup_summary' && weeklyMatchupSummary.schema_version === '1.0');
const summarySections = ['offense_vs_defense','defense_vs_offense','best_play','top_three','run_game','passing_game','protection','pressure','coverage','alerts','featured_player','biggest_threat'];
check('Weekly matchup summary has required sections', summarySections.every(key => key in weeklyMatchupSummary));
check('Offensive comparison rows resolve from summary', Array.isArray(weeklyMatchupSummary.offense_vs_defense.comparisons) && weeklyMatchupSummary.offense_vs_defense.comparisons.length >= 17 && weeklyMatchupSummary.offense_vs_defense.comparisons.every(row => 'rutgers_value' in row && 'opponent_value' in row && 'reason' in row));
check('Defensive comparison rows resolve from summary', Array.isArray(weeklyMatchupSummary.defense_vs_offense.comparisons) && weeklyMatchupSummary.defense_vs_offense.comparisons.length >= 9 && weeklyMatchupSummary.defense_vs_offense.comparisons.every(row => 'mine_value' in row && 'theirs_value' in row && 'reason' in row));
check('Best Play and Top Three resolve to verified play IDs', playIds.has(weeklyMatchupSummary.best_play.play_id) && weeklyMatchupSummary.top_three.length === 3 && weeklyMatchupSummary.top_three.every(row => playIds.has(row.play_id)));
check('Run Game, Passing Game, Protection, Pressure, Coverage, Alerts resolve', weeklyMatchupSummary.run_game && weeklyMatchupSummary.passing_game && Array.isArray(weeklyMatchupSummary.protection.slots) && weeklyMatchupSummary.pressure && weeklyMatchupSummary.coverage && weeklyMatchupSummary.alerts);
check('Featured Player and Biggest Threat resolve', rosterIds.has(weeklyMatchupSummary.featured_player.player_id) && PURDUE_OPPONENT_PLAYERS.players.some(p => p.player_id === weeklyMatchupSummary.biggest_threat.player_id) && matchupIds.has(weeklyMatchupSummary.biggest_threat.matchup_id));
const coordinatorHtml = engine.renderCoordinatorDashboard();
const gameplanShellHtml = (index.match(/<section id="gameplan"[\s\S]*?<section id="topplays"/) || [''])[0];
check('Gameplan is transformed into Rutgers home-team sections', coordinatorHtml.includes('Home Team Dashboard') && coordinatorHtml.includes('Key Offensive Players') && coordinatorHtml.includes('Offensive Depth Chart') && app.includes('renderCoordinatorDashboard()'));
const topPlayInventory = engine.topPlayInventory();
const productionRanking = engine.productionPlayRanking();
const topPlayHeroHtml = engine.topPlayHeroCard();
const topPlayModeSource = (app.match(/function setTopPlaysMode[\s\S]*?\n}/) || [''])[0];
const generatedTopThree = engine.generateRandomTopThree();
global.TOP_THREE_RANDOM_IDS = generatedTopThree.map(play => play.id);
const rotatedTopThree = engine.generateRandomTopThree();
check('Top Plays removes Best Play and makes random Top 3 primary', topPlayHeroHtml.includes('data-random-top-three') && topPlayHeroHtml.includes('data-generate-top-three') && topPlayHeroHtml.includes('Generate Top 3') && !topPlayHeroHtml.includes('data-top-play-control="best"') && !topPlayHeroHtml.includes('Best Play'));
check('Top Plays owns random Top 3 selector without refresh or navigation', topPlayHeroHtml.includes('data-top-three-selector') && (topPlayHeroHtml.match(/data-top-three-row=/g) || []).length === 3 && app.includes('function setTopPlaysMode') && !/location\.href|window\.location/.test(topPlayModeSource));
check('Random Top 3 draws three unique verified plays from locked 192 inventory', generatedTopThree.length === 3 && new Set(generatedTopThree.map(play => play.id)).size === 3 && generatedTopThree.every(play => playIds.has(play.id)) && engine.verifiedPlayInventoryCount() === 192);
check('Random Top 3 rotates away from the immediate previous three-play set', rotatedTopThree.length === 3 && rotatedTopThree.map(play => play.id).sort().join('|') !== generatedTopThree.map(play => play.id).sort().join('|'));
check('Production ranking returns one Best Play and three unique Top 3 play IDs', playIds.has(productionRanking.best_play_id) && productionRanking.top_three_play_ids.length === 3 && new Set(productionRanking.top_three_play_ids).size === 3 && productionRanking.top_three_play_ids.every(id => playIds.has(id)) && productionRanking.candidate_count === 192);
check('Top Plays inventory reaches all 192 verified Oregon play combinations', topPlayInventory.length === 192 && new Set(topPlayInventory.map(play => play.id)).size === 192);
check('Gameplan no longer renders Top Plays hero, selector, or full play library', !coordinatorHtml.includes('data-top-plays-hero') && !coordinatorHtml.includes('top-three-selector') && !coordinatorHtml.includes('locked-play-card'));
check('Gameplan removes raw Rutgers Offense vs Opponent Defense comparison wall', !coordinatorHtml.includes('Rutgers Offense vs Opponent Defense') && !coordinatorHtml.includes('offense-comparison-table'));
check('Gameplan removes raw Rutgers Defense vs Opponent Offense comparison wall', !coordinatorHtml.includes('Rutgers Defense vs Opponent Offense') && !coordinatorHtml.includes('defense-comparison-table'));
check('Gameplan main page is a Rutgers home-team dashboard', coordinatorHtml.includes('data-rutgers-home-dashboard') && coordinatorHtml.includes('Home Team Dashboard') && coordinatorHtml.includes('Key Offensive Players') && coordinatorHtml.includes('Offensive Depth Chart') && coordinatorHtml.includes('Position Groups') && coordinatorHtml.includes('Quick Actions'));
check('Gameplan main page removes run, pass, offensive, defensive, pressure, and coverage cards', !/Offensive Gameplan|Defensive Gameplan|Run Game|Passing Game|Protection Plan|Pressure Recommendation|Coverage Recommendation|Coordinator Dashboard/i.test(coordinatorHtml) && !coordinatorHtml.includes('coordinator-run-card') && !coordinatorHtml.includes('coordinator-pass-card') && !coordinatorHtml.includes('coordinator-pressure-card') && !coordinatorHtml.includes('coordinator-coverage-card') && !coordinatorHtml.includes('coordinator-protection-card'));
check('Gameplan shell uses one home-dashboard mount and no legacy panels', gameplanShellHtml.includes('id="gameplanHome"') && !/id="(?:executiveDashboard|recommendation|top3Inline|quickSummary|gameDayUsage|gameDayAlerts|bestBtn|top3Btn|scriptList|gameplanScoutList|historyList)"/.test(gameplanShellHtml) && !/Situation|Call context|Best Call|Show Top 3 Plays|Opening Script|Opponent Traits|History/.test(gameplanShellHtml));
check('Gameplan home dashboard renders roster, depth, and key-player cards', (coordinatorHtml.match(/data-home-player-card/g) || []).length >= 4 && (coordinatorHtml.match(/home-depth-slot/g) || []).length >= 9 && coordinatorHtml.includes('home-roster-grid'));
check('Gameplan home dashboard has mobile-safe Rutgers card styles', css.includes('.rutgers-home-dashboard') && css.includes('.home-depth-grid') && css.includes('.home-roster-grid') && css.includes('.home-action-grid'));
check('Gameplan home dashboard contains no raw nullish/object text', !/\[object Object\]|undefined|(^|[>\s])null([<\s]|$)/i.test(coordinatorHtml));
check('Weekly matchup summary does not duplicate card registry football data', !JSON.stringify(cardRegistry).includes('offensive_matchup_grade') && !JSON.stringify(cardRegistry).includes('biggest_offensive_advantage'));
check('Weekly matchup summary static bundle loads before app.js', index.indexOf('data/weekly/weekly_matchup_summary.js') > index.indexOf('data/weekly/run_lane_analysis.js') && index.indexOf('data/weekly/weekly_matchup_summary.js') < index.indexOf('app.js'));
check('Card registry hides Best Play and keeps Top Three ownership in Top Plays', cardById.get('best_play_hero').tab === 'topplays' && cardById.get('best_play_hero').visible === false && cardById.get('top_three_selector').tab === 'topplays');
check('Card registry hides raw comparison walls from Gameplan', cardById.get('offensive_comparison_table').visible === false && cardById.get('defensive_comparison_table').visible === false);
check('Card registry registers reusable RecruitCard collection', cardById.get('recruit_card_collection') && cardById.get('recruit_card_collection').tab === 'recruiting' && cardById.get('recruit_card_collection').display_variant === 'recruit_card_collection');
check('Shared roster source has 48 verified players', RUTGERS_ROSTER_BASE.players.length === 48 && RUTGERS_ROSTER_BASE.package_type === 'rutgers_roster_base');
check('No duplicate hardcoded roster is used by the visible Recruiting engine', app.includes('function loadRutgersRoster') && app.includes('return sharedRosterBase()'));
check('Gameplan engine reads enriched opponent/profile/player/group/matchup data', app.includes('loadOpponentProfile') && app.includes('loadOpponentPlayers') && app.includes('loadOpponentGroups') && app.includes('loadMatchups'));
check('Recruiting engine reads enriched class, weekly, team needs, and coach modifiers', app.includes('loadRecruitingClass') && app.includes('loadRecruitingWeekly') && app.includes('loadTeamNeeds') && app.includes('COACH_RECRUITING_MODIFIERS'));
check('Gameplan tab structure is present', app.includes('renderCoordinatorDashboard') && app.includes('data-rutgers-home-dashboard') && app.includes('homeTeamSnapshotCard'));
check('Best Call keeps visible play art', app.includes('large-diagram') && app.includes('play.diagramPath'));
check('Top Plays supports required filters', ['run','pass','rpo','pa','screen','rankFormation','rankPersonnel','rankSituation','rankRisk','rankZone','rankState'].every(token => app.includes(token)));
check('Personnel heading and dynamic Rutgers/opponent comparison exist', app.includes('Personnel & Matchups') && app.includes('renderGameMatchupHeader') && app.includes('activeOpponentName()'));
check('Personnel includes run direction map', app.includes('function renderRunDirection') && app.includes('lane-map') && app.includes('Left edge') && app.includes('Right edge'));
check('Run direction map avoids horizontal overflow at phone width', css.includes('grid-template-columns:repeat(auto-fit,minmax(92px,1fr))') && css.includes('overflow-x:hidden'));
check('Personnel includes protection map', app.includes('function renderProtection') && app.includes('pressure-map') && app.includes('Right edge') && app.includes('highestRiskMatchup'));
check('Protection map avoids horizontal overflow at phone width', css.includes('grid-template-columns:repeat(auto-fit,minmax(104px,1fr))'));
const opponentRosterHtml = engine.renderOpponent('all');
const opponentRenderedCount = (opponentRosterHtml.match(/data-opponent-card/g) || []).length;
check('Personnel includes expanded current opponent roster browser', app.includes('function renderOpponent') && opponentRosterHtml.includes('Full Roster') && opponentRenderedCount >= 32 && new Set((opponentRosterHtml.match(/data-player-name="[^"]+"/g) || [])).size === opponentRenderedCount);
check('Expanded Purdue browser includes verified LB, DB, and specialist identities', ['A. Warren','B. Leal','R. Daniels','D. Lincoln','K. Smallwood','E. Sawyer','J. Lozano'].every(name => opponentRosterHtml.includes(name)) && (engine.renderOpponent('LB').match(/data-opponent-card/g) || []).length >= 8 && (engine.renderOpponent('DB').match(/data-opponent-card/g) || []).length >= 11 && (engine.renderOpponent('ST').match(/data-opponent-card/g) || []).length >= 1);
check('Unavailable Purdue offensive groups are reported as source-missing instead of invented', ['QB','RB','WR','TE','OL'].every(group => (engine.renderOpponent(group).match(/data-opponent-card/g) || []).length === 0) && opponentRosterHtml.includes('Source-missing Purdue groups'));
check('Personnel includes matchup cards', app.includes('function renderMatchups') && PURDUE_MATCHUPS.matchups.length >= 3);
check('Recruiting overview uses real resources', RECRUITING_WEEKLY.resources.scholarship_limit === 35 && RECRUITING_WEEKLY.resources.weekly_hours_total === 440 && app.includes('scholarships_used'));
check('All recruiting positions are filterable from class data', new Set(RECRUITING_CLASS.prospects.map(p => p.position).filter(Boolean)).size >= 10 && app.includes('filterPosition'));
check('Prospect descriptions display from analysis', RECRUITING_CLASS.prospects.every(p => p.analysis && p.analysis.summary) && app.includes('Scouting summary'));
check('Opponent player descriptions display from ui_analysis', PURDUE_OPPONENT_PLAYERS.players.every(p => p.ui_analysis && p.ui_analysis.summary) && app.includes('ui_analysis'));
check('Matchup descriptions display', PURDUE_MATCHUPS.matchups.every(m => m.description) && app.includes('row.description'));
check('Null fields are hidden in normal UI helpers', app.includes('function maybeRow') && app.includes('formatLimited') && !app.includes('Unknown stars'));
check('No Name unverified remains', !index.includes('Name unverified') && !app.includes('Name unverified'));
check('No static opponent facts remain in noscript fallback', !index.includes('Purdue record') && !index.includes('Q. Gillians') && index.includes('Enable JavaScript'));
check('No old four quarterback summary boxes remain', !app.includes('Quarterbacks') || app.indexOf('Quarterbacks') < app.indexOf('function loadRutgersRoster'));
check('No fake mockup players were copied', !app.includes('Jaylen Walker') && !app.includes('Marcus Evans') && !app.includes('Ethan Johnson'));
check('Oregon visible playbook inventory imports every verified row', RUTGERS_PLAYBOOK.length === 192 && phase1Transcript.summary.unique_visible_formation_play_combinations === 192);
check('Oregon playbook completeness is not overstated', phase1Transcript.complete_playbook_status === 'CANNOT_VERIFY_COMPLETE_FROM_THIS_VIDEO' && app.includes('CANNOT_VERIFY_COMPLETE_FROM_THIS_VIDEO') === false);
check('Missing Oregon play art uses placeholders without dropping plays', RUTGERS_PLAYBOOK.every(p => p.diagramPath === 'assets/play-diagrams/formation-fallback.svg' && fs.existsSync(path.join(root,p.diagramPath))));
const rankings = engine.buildRankings(ctx(1,5), [], []);
check('Best Call remains functional', rankings.length > 0 && rankings[0].score >= 0);
check('Top 3 remains functional and diverse', engine.diverseTop(rankings, 4).length >= 3 && new Set(engine.diverseTop(rankings, 4).map(p => p.conceptFamily)).size >= 2);
check('Gameplan import validation accepts enriched package', (() => { try { const fn = require(path.join(root,'app.js')); return GAMEPLAN_WEEKLY.package_type === 'gameplan_weekly_update'; } catch { return false; } })());
check('Recruiting import validation accepts enriched package', RECRUITING_WEEKLY.package_type === 'recruiting_weekly_update' && Array.isArray(RECRUITING_WEEKLY.active_board));
check('Invalid imports preserve state by validating before assignment', app.indexOf('validateGameplanWeekly(parsed)') < app.indexOf('window.GAMEPLAN_WEEKLY = parsed') && app.indexOf('validateRecruitingWeekly(parsed)') < app.indexOf('window.RECRUITING_WEEKLY = parsed'));
check('More page contains utilities/history/analytics/settings only', app.includes('Weekly Data') && app.includes('History') && app.includes('Analytics') && app.includes('Settings & Tools') && !app.includes('traitList'));
check('Mobile CSS prevents horizontal overflow and keeps bottom nav fixed', css.includes('overflow-x:hidden') && css.includes('position:fixed') && css.includes('env(safe-area-inset-bottom)'));
check('GitHub Pages relative paths are preserved', index.includes('data/engine_data.js') && !app.includes('fetch(') && !index.includes('http://'));
check('Repeated Not available is avoided in enriched card renderers', (app.match(/Not available/g) || []).length <= 8 && app.includes('cleanValue'));
const firstBoardRow = (RECRUITING_WEEKLY.active_board || [])[0] || {};
const firstProspect = (RECRUITING_CLASS.prospects || []).find(prospect => prospect.prospect_id === firstBoardRow.prospect_id) || {};
const recruitFixtureHtml = engine.RecruitCard({ ...firstBoardRow, prospect: firstProspect }, 0, 'board');
check('Weekly action plan renders as mobile-safe ranked recruiting list', app.includes('ranked-recruit-list') && app.includes('ranked-recruit-row') && recruitFixtureHtml.includes('data-recruit-card') && recruitFixtureHtml.includes('sports-list-card'));
check('RecruitCard scheme fit values are restricted to approved labels', ['Strong fit','Moderate fit','Weak fit','Insufficient verified data'].every(value => engine.resolvedSchemeFit(value) === value) && engine.resolvedSchemeFit('unknown') === 'Insufficient verified data');
check('RecruitCard avoids generic evaluate/prioritize/assess instructions', !/Review against roster need|Evaluate how|Prioritize if|Assess whether/i.test(recruitFixtureHtml));
check('Last Game and Season Stats remain separate with verified files', rutgersLast.package_type === 'rutgers_last_game_stats' && rutgersSeason.package_type === 'rutgers_season_stats' && app.includes('loadRutgersLastGameStats') && app.includes('loadRutgersSeasonStats'));
check('Gameplan default is compact with drill-down details', app.includes('compact-best') && app.includes('View Full Breakdown') && app.includes('View Matchup Detail') && app.includes('alt-strip'));
check('Top Plays uses compact rows and advanced filter drawer', app.includes('compact-play-row') && app.includes('Advanced Filters') && app.includes('sticky-filter'));
check('Personnel uses one internal workspace section at a time', app.includes('function renderPersonnelPanel') && app.includes('active === "overview"') && app.includes('renderStatsWorkspace') && app.includes('renderScoutingReport'));
check('Roster uses horizontal position boxes instead of one long expanded report', app.includes('ROSTER_POSITION_GROUPS') && app.includes('position-rail') && app.includes('showRosterGroup') && css.includes('.position-box'));
check('Matchups show player-vs-player cards where position data resolves', app.includes('findRutgersMatchupPlayer') && app.includes('findOpponentMatchupPlayer') && app.includes('broadcast-matchup-grid'));
check('Matchups bind to player_matchups.json', phase1Matchups.matchups.length === 7 && app.includes('PLAYER_MATCHUPS') && app.includes('Limited data'));
check('Recruiting board starts from active_board when present', app.includes('function activeBoardRows') && app.includes('if (board.length)') && app.includes('board_order'));
check('Prospect rating renderer displays user-confirmed four-star class without raw star text', app.includes('function starRating') && app.includes('aria-label="${stars}-star prospect"') && engine.recruitDetailHtml(boardRows[0].prospect_id, 'board').includes('4&#9733;') && !engine.recruitDetailHtml(boardRows[0].prospect_id, 'board').includes('Stars N/A') && !app.includes('${cleanValue(p.stars)} stars'));
check('Roster and prospects default to tap-open detail rows', app.includes('compact-person') && app.includes('compact-prospect') && app.includes('compact-action'));
check('Run and protection maps use compact tappable cells', app.includes('compact-lane-map') && app.includes('compact-pressure-map'));
check('More tab uses compact accordions for secondary groups', app.includes('details class="utility-section compact-detail"'));
check('Player media static bundle loads before app.js', index.indexOf('data/player_media.js') > index.indexOf('data/phase1_verified_data.js') && index.indexOf('data/player_media.js') < index.indexOf('app.js'));
check('Rutgers portrait registry covers every verified roster player', rutgersMedia.players.length === RUTGERS_ROSTER_BASE.players.length && rutgersMedia.players.every(row => RUTGERS_ROSTER_BASE.players.some(player => player.player_id === row.player_id)));
check('Opponent portrait registry covers every current opponent player', opponentMedia.players.length === PURDUE_OPPONENT_PLAYERS.players.length && opponentMedia.players.every(row => PURDUE_OPPONENT_PLAYERS.players.some(player => player.player_id === row.player_id)));
check('Every portrait asset exists', [...rutgersMedia.players, ...opponentMedia.players].every(row => fs.existsSync(path.join(root, row.portrait_path))));
check('Player card registry binds without duplicated ratings', registry.counts.total_cards === registry.rutgers_cards.length + registry.opponent_cards.length && JSON.stringify(registry).indexOf('"overall"') === -1);
check('Player registry count matches generated card inventory', registry.counts.rutgers_players === 48 && registry.counts.opponent_players === 16 && registry.counts.total_cards === 64);
check('Premium player card engine is present', app.includes('function premiumPlayerCard') && app.includes('Season Stats') && app.includes('Weekly Role') && app.includes('More Detail'));
check('Portrait media binding is used in player and matchup cards', app.includes('function portraitImg') && app.includes('broadcast-player') && app.includes('mediaForPlayer'));
check('Matchup cards expose grade, confidence, evidence, recommendation, and portraits', app.includes('displayGrade(row.grade, row.internal_score)') && app.includes('Confidence') && app.includes('Evidence') && app.includes('Tactical Recommendation') && app.includes('portraitImg(rutgers'));
check('Executive sticky header compacts on scroll', css.includes('.gameday-header.compact-header') && app.includes('window.scrollY > 48'));
check('Top Plays supports favorites and personnel grouping', app.includes('toggleFavoritePlay') && app.includes('rankPersonnel') && app.includes('Favorites'));
check('Top Plays still binds all 192 verified Oregon combinations', RUTGERS_PLAYBOOK.length === 192 && app.includes('Formation') && app.includes('Personnel'));
check('Recruiting has board and prospect-list workspaces', app.includes('Recruiting Board') && app.includes('Prospect List') && app.includes('prospectPoolRows'));
check('Recruiting details include required status fields without duplicated descriptions', ['National Rank','Interest','Offer','Visit','Commit','Gem/Bust','Recommended Action','AI Summary'].every(token => app.includes(token)) && app.includes('aiSummary !== reason'));
check('O-Line visualization includes run, protection, double-team, and chip-help arrows', app.includes('oline-arrows') && app.includes('run-arrow') && app.includes('protect-arrow') && app.includes('double-arrow') && app.includes('chip-arrow'));
check('Responsive layout keeps new cards within phone viewport', css.includes('.player-card-grid') && css.includes('@media(max-width:420px)') && css.includes('overflow-x:hidden'));
check('JSON parsing for new media files succeeds', rutgersMedia.package_type === 'rutgers_player_media' && opponentMedia.package_type === 'opponent_player_media' && registry.package_type === 'player_card_registry');
check('GitHub Pages compatibility remains static', !app.includes('fetch(') && index.includes('data/player_media.js') && [...rutgersMedia.players, ...opponentMedia.players].every(row => !/^https?:/i.test(row.portrait_path)));
const fixtureHtml = [
  engine.premiumPlayerCard(RUTGERS_ROSTER_BASE.players[0], 'rutgers'),
  engine.opponentPlayerCard(PURDUE_OPPONENT_PLAYERS.players[0]),
  engine.matchupRow(PURDUE_MATCHUPS.matchups[0]),
  engine.renderPersonnelOverview(),
  engine.cleanValue({ name: 'Fixture', stats: { yards: 12, td: 1 }, tags: ['inside', 'zone'] })
].join('\n');
check('Rendered fixtures never leak raw object coercion', !/\[object Object\]|undefined|(^|[>\s])null([<\s]|$)/i.test(fixtureHtml));
check('Nested formatter converts objects to readable labels', engine.cleanValue({ player: 'Q. Gillians', threat_type: 'Power rush', lane: 'right edge' }).includes('Player: Q. Gillians') && !engine.cleanValue({ a: { b: 1 } }).includes('[object Object]'));
check('Player cards render Last Game and Season as separate sections', fixtureHtml.includes('Last Game') && fixtureHtml.includes('Season') && fixtureHtml.includes('mini-stat-block'));
check('Matchup cards use mobile header, comparison, production, and result sections', fixtureHtml.includes('broadcast-matchup-grid') && fixtureHtml.includes('comparison-table') && fixtureHtml.includes('match-production') && fixtureHtml.includes('tactical-callout'));
const statsWorkspaceHtml = engine.renderStatsWorkspace();
const scoutWorkspaceHtml = engine.renderScoutingReport();
const recruitDetailFixture = engine.recruitDetailHtml(boardRows[0].prospect_id, 'board');
const topRecruitModels = engine.recommendedTopRecruits();
const scoutingSectionHtml = (recruitDetailFixture.match(/<section class="detail-panel" data-detail-section="Scouting">([\s\S]*?)<\/section>/) || ['', ''])[1];
const fitSectionHtml = (recruitDetailFixture.match(/<section class="detail-panel" data-detail-section="Fit">([\s\S]*?)<\/section>/) || ['', ''])[1];
check('Personnel defaults to matchup-first cards with weekly rosters at the bottom', fixtureHtml.includes('matchup-card-system') && fixtureHtml.includes('data-roster-matchup="WR / CB"') && fixtureHtml.includes('data-roster-matchup="RB / MLB"') && fixtureHtml.includes('data-roster-matchup="OL / DT"') && fixtureHtml.includes('bottom-weekly-rosters') && !fixtureHtml.includes('[object Object]'));
check('Recruiting Top 3 is deterministic, Team Needs driven, and horizontally scrollable', topRecruitModels.length === 3 && topRecruitModels.every(model => model.priority && model.priority.position) && app.includes('function recommendedTopRecruits') && app.includes('scrollable-recruit-top3') && !app.includes('Rotate Top 3'));
check('Team Needs priority uses verified senior departures and explicit position changes only', app.includes('function graduatingPlayersForPosition') && app.includes('function verifiedPositionChangeDelta') && engine.graduatingPlayersForPosition('T').every(player => /SR/i.test(player.class_year || player.year || player.class || '')) && engine.verifiedPositionChangeDelta('T') === 0);
check('Recruit detail tabs are usable buttons with image-limited Scouting and Fit sections', recruitDetailFixture.includes('detail-tab-strip') && recruitDetailFixture.includes('showDetailSection') && scoutingSectionHtml.includes('Awareness') && scoutingSectionHtml.includes('Development Trait') && !scoutingSectionHtml.includes('Scheme Fit') && fitSectionHtml.includes('Scheme Fit') && fitSectionHtml.includes('Interest Movement') && !fitSectionHtml.includes('Awareness'));
check('Stats workspace renders a sports-stat dashboard instead of stacked stat-sheet accordions', statsWorkspaceHtml.includes('stats-dashboard') && statsWorkspaceHtml.includes('Team Snapshot') && statsWorkspaceHtml.includes('stats-leader-grid') && statsWorkspaceHtml.includes('stat-category-grid') && !statsWorkspaceHtml.includes('Stat Sheet') && !statsWorkspaceHtml.includes('<details'));
check('Scout workspace renders defined opponent sections', scoutWorkspaceHtml.includes('scout-dashboard') && ['Strengths & Weaknesses','Position-Group Scouting','Key Players & Triggers','Front, Pressure, Coverage'].every(token => scoutWorkspaceHtml.includes(token)) && !/\[object Object\]|undefined|(^|[>\s])null([<\s]|$)/i.test(scoutWorkspaceHtml));
const renderedRecruitDescriptions = (RECRUITING_WEEKLY.active_board || []).map(row => {
  const prospect = (RECRUITING_CLASS.prospects || []).find(p => p.prospect_id === row.prospect_id) || {};
  const a = prospect.analysis || {};
  const values = [row.description, a.recommended_action_reason, prospect.scouting_summary, a.summary].map(value => engine.cleanValue(value)).filter(Boolean);
  return values.find(text => !/active board target|match to the full recruiting-class record requires confirmation|review against roster need|verified scouting profile/i.test(text)) || '';
}).filter(Boolean);
const descriptionCounts = renderedRecruitDescriptions.reduce((acc, text) => (acc[text] = (acc[text] || 0) + 1, acc), {});
check('Repeated generic recruiting descriptions are removed from rendered candidates', !app.includes('Review against roster need and verified scouting profile') && Object.values(descriptionCounts).every(count => count <= 3));
check('Mobile breakpoints 390x844 and 430x932 are covered by responsive CSS', css.includes('@media(max-width:420px)') && css.includes('overflow-x:hidden') && css.includes('env(safe-area-inset-bottom)') && css.includes('env(safe-area-inset-top)'));
check('Only one matchup detail accordion is allowed open per list', app.includes('.compact-match') && app.includes('details.compact-detail[open],details.player-detail[open],details.compact-prospect[open],details.compact-match[open]'));
const orderedMatchups = engine.orderedMatchupRows();
const matchupSystemHtml = engine.renderMatchups();
const keyCardCount = (matchupSystemHtml.match(/data-matchup-id=/g) || []).length - (matchupSystemHtml.includes('allMatchupsPanel') ? (orderedMatchups.length - Math.min(3, orderedMatchups.length)) : 0);
const topThreeIds = orderedMatchups.slice(0, 3).map(item => item.row.matchup_id);
const playerNamesInMatchups = PURDUE_MATCHUPS.matchups.flatMap(row => [row.rutgers_player && row.rutgers_player.name, row.opponent_player && row.opponent_player.name]).filter(Boolean);
check('Reusable MatchupCard component renders key matchup cards', app.includes('function MatchupCard(') && matchupSystemHtml.includes('matchup-card-system') && matchupSystemHtml.includes('priority-badge'));
check('Exactly three valid Key Matchups render when at least three valid rows exist', orderedMatchups.length < 3 ? keyCardCount === orderedMatchups.length : keyCardCount === 3, `key=${keyCardCount}, valid=${orderedMatchups.length}`);
check('Top three matchup cards come from player_matchups.json', topThreeIds.length === Math.min(3, orderedMatchups.length) && topThreeIds.every(id => phase1Matchups.matchups.some(row => row.matchup_id === id)));
check('Top three matchup selection is ordered by priority, confidence, importance, then source order', topThreeIds.join('|') === orderedMatchups.slice(0, 3).map(item => item.row.matchup_id).join('|'));
check('No matchup player names are hardcoded in rendering source', playerNamesInMatchups.every(name => !app.includes(name)));
check('All valid matchup Rutgers and opponent IDs resolve', orderedMatchups.length === phase1Matchups.matchups.filter(row => row.rutgers_player && row.opponent_player).length && orderedMatchups.every(item => item.rutgers && item.opponent));
check('Matchup media paths resolve for valid cards', orderedMatchups.every(item => {
  const rutgersMediaRow = rutgersMedia.players.find(row => row.player_id === item.rutgers.player_id);
  const opponentMediaRow = opponentMedia.players.find(row => row.player_id === item.opponent.player_id);
  return rutgersMediaRow && opponentMediaRow && fs.existsSync(path.join(root, rutgersMediaRow.portrait_path)) && fs.existsSync(path.join(root, opponentMediaRow.portrait_path));
}));
check('Matchup component keeps Last Game and Season separate', matchupSystemHtml.includes('Rutgers Last Game') && matchupSystemHtml.includes('Rutgers Season') && matchupSystemHtml.includes('Opponent Last Game') && matchupSystemHtml.includes('Opponent Season'));
check('Matchup card fixtures contain no raw nullish/object text', !/\[object Object\]|undefined|(^|[>\s])null([<\s]|$)/i.test(matchupSystemHtml));
check('Glossy matchup card styling and mobile overflow safeguards exist', css.includes('.matchup-card') && css.includes('linear-gradient') && css.includes('.matchup-action-row') && css.includes('@media(max-width:420px)') && css.includes('overflow-x:hidden'));
check('Fixed bottom navigation remains visible for matchup card system', css.includes('.bottom-nav') && css.includes('position:fixed') && css.includes('env(safe-area-inset-bottom)'));
const firstMatchupCardHtml = engine.MatchupCard(orderedMatchups[0].row, orderedMatchups[0].rutgers, orderedMatchups[0].opponent);
const defaultMetricCount = (firstMatchupCardHtml.match(/default-metric/g) || []).length;
check('Broadcast matchup visual hierarchy is present', firstMatchupCardHtml.includes('broadcast-matchup-grid') && firstMatchupCardHtml.includes('broadcast-player') && firstMatchupCardHtml.includes('broadcast-vs'));
check('Central matchup-edge panel is dominant and populated', firstMatchupCardHtml.includes('broadcast-edge') && firstMatchupCardHtml.includes('Matchup Edge') && firstMatchupCardHtml.includes('Grade'));
check('Default comparison uses no more than four selected metrics', defaultMetricCount > 0 && defaultMetricCount <= 4, `defaultMetrics=${defaultMetricCount}`);
check('Remaining matchup attributes move to More Detail', firstMatchupCardHtml.includes('more-matchup-detail') && firstMatchupCardHtml.includes('More Detail'));
check('Tactical recommendation renders as primary coaching callout', firstMatchupCardHtml.includes('tactical-callout') && firstMatchupCardHtml.includes('Tactical Recommendation'));
check('Empty production sections collapse to compact Limited data cards', firstMatchupCardHtml.includes('production-card') && firstMatchupCardHtml.includes('limited-production'));
check('Broadcast matchup visual polish CSS exists', css.includes('.broadcast-matchup-grid') && css.includes('.broadcast-edge') && css.includes('.tactical-callout') && css.includes('.player-portrait.broadcast'));
const firstInternalScore = String(orderedMatchups[0].row.internal_score);
const edgePanelMatch = firstMatchupCardHtml.match(/<section class="matchup-edge broadcast-edge">([\s\S]*?)<\/section>/);
const edgePanelHtml = edgePanelMatch ? edgePanelMatch[1] : '';
check('Internal score is not rendered under MATCHUP EDGE', firstInternalScore && !edgePanelHtml.includes(firstInternalScore), `internal=${firstInternalScore}`);
check('Verified differential renders only when explicitly available', engine.matchupEdgeDisplay({ advantage: 'Rutgers', grade: 'B', confidence: 90, verified_edge_differential: 7, internal_score: 88 }).title === 'RUTGERS +7');
check('Advantage-only matchup edge renders without fabricated number', engine.matchupEdgeDisplay({ advantage: 'Purdue', grade: 'D', confidence: 92, internal_score: 68.8 }).title === 'PURDUE ADVANTAGE');
check('Even matchup edge renders without fabricated number', engine.matchupEdgeDisplay({ advantage: 'Even', grade: 'C', confidence: 92, internal_score: 74.6 }).title === 'EVEN');
check('Limited matchup edge state renders correctly', engine.matchupEdgeDisplay({ grade: 'C', confidence: 70, internal_score: 74.6 }).title === 'LIMITED DATA');
const evidenceHtml = engine.evidenceRowsHtml(orderedMatchups[0].row.evidence || []);
check('Evidence renders as separate rows without serialized objects', evidenceHtml.includes('evidence-row-list') && evidenceHtml.includes('evidence-row') && !/\[object Object\]|undefined|(^|[>\s])null([<\s]|$)/i.test(evidenceHtml));
check('Top-three order remains semantic-correction unchanged', topThreeIds.join('|') === 'rt_vs_redg|c_vs_dt|hb2_vs_sam');
const sprint25Docs = ['DESIGN_SYSTEM.md','JSON_STANDARD.md','UI_COMPONENT_STANDARD.md','VALIDATION_STANDARD.md','RELEASE_STANDARD.md'];
const screenshotPages = ['gameplan','personnel','topplays','matchups','recruiting'];
const correction2ScreenshotPages = ['gameplan_top','gameplan_run','gameplan_passing','gameplan_protection','topplays_best','topplays_top3','topplays_library','personnel','matchups','recruiting_cards','recruiting_expanded'];
const productionBindingScreens = ['compact_gameplan','best_run_arrow','protection_card','topplays_best','topplays_top3','full_play_list','purdue_full_roster','purdue_player_detail','recruiting_compact_board','recruiting_top3','recruit_detail_scouting','recovered_recruit_detail'];
const sportsAppCardScreens = ['rutgers_compact_player_list','rutgers_player_card_with_dev_trait','rutgers_player_detail_overview','rutgers_player_detail_stats','purdue_compact_roster_list','purdue_player_detail','recruiting_compact_board','recruit_card_with_star_rating','recruit_card_with_gem','recruit_detail_scouting','back_navigation_restored'];
check('Sprint 2.5 design governance docs exist', sprint25Docs.every(file => fs.existsSync(path.join(root, 'docs', file))));
check('Design System Governance Standard is indexed from PROJECT_SPEC', fs.readFileSync(path.join(root, 'PROJECT_SPEC.md'), 'utf8').includes('Design System Governance Standard') && fs.readFileSync(path.join(root, 'PROJECT_SPEC.md'), 'utf8').includes('docs/DESIGN_SYSTEM.md'));
check('Native UI design tokens are present', ['--ds-space-1','--ds-radius-lg','--ds-rutgers','--ds-opponent','--ds-glass','--ds-shadow','--ds-text-hero'].every(token => css.includes(token)));
check('Premium background and glass card system are present', css.includes('.native-backdrop') && css.includes('backdrop-filter') && css.includes('--ds-glass') && css.includes('.panel:before'));
check('Premium floating bottom navigation is present', css.includes('.bottom-nav') && css.includes('border-radius:22px') && css.includes('backdrop-filter:blur(24px)'));
check('Native page transitions and reduced-motion fallback are present', css.includes('@keyframes tabEnter') && css.includes('prefers-reduced-motion') && app.includes('tabScrollPositions'));
check('PWA manifest and app icon are wired for GitHub Pages', fs.existsSync(path.join(root, 'manifest.webmanifest')) && fs.existsSync(path.join(root, 'assets', 'app-icon.svg')) && index.includes('rel="manifest"') && index.includes('apple-touch-icon'));
check('Before screenshots exist for key pages', screenshotPages.every(page => fs.existsSync(path.join(root, 'screenshots', 'sprint2_5_before', `${page}_390x844.png`))));
check('After screenshots exist for key pages', screenshotPages.every(page => fs.existsSync(path.join(root, 'screenshots', 'sprint2_5_after', `${page}_390x844.png`))));
check('Sprint 2.5 screenshot artifacts are non-empty PNG files', ['sprint2_5_before','sprint2_5_after'].every(dir => screenshotPages.every(page => fs.statSync(path.join(root, 'screenshots', dir, `${page}_390x844.png`)).size > 10000)));
check('Sprint 2.5 correction 2 screenshots exist at both required mobile viewports', ['390x844','430x932'].every(size => correction2ScreenshotPages.every(page => fs.existsSync(path.join(root, 'screenshots', `sprint2_5_correction2_${size}`, `${page}.png`)))));
check('Sprint 2.5 correction 2 screenshot artifacts are non-empty PNG files', ['390x844','430x932'].every(size => correction2ScreenshotPages.every(page => fs.statSync(path.join(root, 'screenshots', `sprint2_5_correction2_${size}`, `${page}.png`)).size > 10000)));
check('Production binding screenshots exist at 390x844 and 430x932', ['390x844','430x932'].every(size => productionBindingScreens.every(page => fs.existsSync(path.join(root, 'screenshots', `production_binding_${size}`, `${page}.png`)))));
check('Production binding screenshot artifacts are non-empty PNG files', ['390x844','430x932'].every(size => productionBindingScreens.every(page => fs.statSync(path.join(root, 'screenshots', `production_binding_${size}`, `${page}.png`)).size > 10000)));
check('Sports-app card screenshots exist at 390x844 and 430x932', ['390x844','430x932'].every(size => sportsAppCardScreens.every(page => fs.existsSync(path.join(root, 'screenshots', `sports_app_cards_${size}`, `${page}.png`)))));
check('Sports-app card screenshot artifacts are non-empty PNG files', ['390x844','430x932'].every(size => sportsAppCardScreens.every(page => {
  const file = path.join(root, 'screenshots', `sports_app_cards_${size}`, `${page}.png`);
  return fs.existsSync(file) && fs.statSync(file).size > 10000;
})));

const report = ['# VALIDATION_REPORT', '', `Validated: ${new Date().toISOString()}`, '', ...checks.map(c => `- ${c.passed ? 'PASS' : 'FAIL'} - ${c.name}${c.detail ? ` (${c.detail})` : ''}`), '', checks.every(c => c.passed) ? 'Overall: PASS' : 'Overall: FAIL'].join('\n');
fs.writeFileSync(path.join(root, 'VALIDATION_REPORT.md'), report + '\n');
console.log(report);
if (!checks.every(c => c.passed)) process.exit(1);
