import { createGameDatabase, putRecord, getRecord, listRecords } from '../packages/game-mechanics/src/persistence.js';
import { hydrateMaritimeGame } from './model/game.js';
import { quadsToRows, rowsToQuads } from '../packages/game-mechanics/src/hidden-information/rdf-capsule.js';
import { decodeSetup, boardSeed } from './network.js';
import { generateBoardPair } from './rules/board.js';
import { RandomEngine } from '../packages/game-mechanics/src/random-engine.js';
import { MW } from './model/vocabulary.js';

export const FORMAT = 'maritime-warship-save', VERSION = 2, MAX_SAVE_BYTES = 96_000_000;
let database;
const db = () => database ||= createGameDatabase({ name: 'maritime-warship-local-v2' });

export function localSave(game, setup) {
  const snapshot = game.snapshot();
  return { format: FORMAT, version: VERSION, schemaVersion: '0.2.0', gameVersion: '0.2.0', audience: 'local-player', savedAt: new Date().toISOString(),
    sessionId: snapshot.sessionId, quads: quadsToRows(snapshot.quads), transactions: snapshot.transactions, rngState: snapshot.rngState, setup: { code: setup.code } };
}
export async function parseLocalSave(value) {
  assertSave(value, 'local-player');
  const quads = safeRows(value.quads);
  if (!Array.isArray(value.transactions) || value.transactions.length > 5000 || value.transactions.some((entry, i) => !entry || !entry.delta || !Array.isArray(entry.delta.additions) || !Array.isArray(entry.delta.removals) || entry.sequence !== i + 1)) throw new Error('Invalid transaction history.');
  for (const entry of value.transactions) {
    safeRows(quadsToRows(entry.delta.additions)); safeRows(quadsToRows(entry.delta.removals));
  }
  if (!Number.isInteger(value.rngState) || value.rngState < 0 || value.rngState > 0xffffffff) throw new Error('Invalid random state.');
  if (typeof value.sessionId !== 'string' || value.sessionId.length > 100) throw new Error('Invalid match identifier.');
  const game = hydrateMaritimeGame({ sessionId: value.sessionId, quads, transactions: value.transactions, rngState: value.rngState });
  const setup = await decodeSetup(value.setup?.code);
  const state = game.state();
  for (const key of ['rows', 'columns', 'obstacles', 'climate', 'salvo', 'fleet', 'budget']) if (JSON.stringify(state.config[key]) !== JSON.stringify(setup.config[key])) throw new Error('Save configuration does not match its setup code.');
  const terrain = generateBoardPair(setup.config, new RandomEngine(boardSeed(setup)));
  if (state.players.some((player, index) => [...player.obstacles].sort().join(',') !== [...terrain.obstacles[index]].sort().join(','))) throw new Error('Saved terrain does not match the public setup code.');
  return { game, setup };

}
export function assertSave(value, audience) {
  if (!value || value.format !== FORMAT || value.version !== VERSION || value.schemaVersion !== '0.2.0' || value.audience !== audience) throw new Error('This file is not a supported Maritime Warship ' + audience + ' save.');
}
export function safeRows(rows) {
  if (!Array.isArray(rows) || rows.length > 200_000) throw new Error('Invalid or oversized RDF dataset.');
  for (const row of rows) {
    if (!row || row.subject?.termType !== 'NamedNode' || row.predicate?.termType !== 'NamedNode' || !['NamedNode', 'Literal'].includes(row.object?.termType) || row.graph?.termType !== 'DefaultGraph') throw new Error('Only named subjects and ordinary default-graph RDF are supported.');
    for (const term of [row.subject, row.predicate, row.object]) if (typeof term.value !== 'string' || term.value.length > 1000) throw new Error('Invalid RDF term.');
    if (row.object.termType === 'Literal' && (typeof row.object.datatype !== 'string' || !/^https?:\/\//.test(row.object.datatype) || (row.object.language !== undefined && typeof row.object.language !== 'string'))) throw new Error('Invalid RDF literal datatype or language.');
    if (![MW, 'http://purl.obolibrary.org/obo/', 'https://www.commoncoreontologies.org/', 'http://www.w3.org/', 'https://w3id.org/ontologized-entertainment/game/'].some(prefix => row.predicate.value.startsWith(prefix))) throw new Error('Unknown predicate namespace.');
  }
  return rowsToQuads(rows);
}
export async function saveActive(record) {
  const connection = await db();
  await putRecord(connection, 'saveStates', { id: record.audience, value: record });
  await putRecord(connection, 'preferences', { id: 'active', audience: record.audience });
  return record;
}
export async function loadActive() {
  const connection = await db(), active = await getRecord(connection, 'preferences', 'active');
  return active ? (await getRecord(connection, 'saveStates', active.audience))?.value : null;
}
export async function archiveMatch(record, summary) {
  await putRecord(await db(), 'games', { id: record.sessionId || record.savedAt, savedAt: record.savedAt, ...summary });
}
export async function listHistory() { return (await listRecords(await db(), 'games')).sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(0, 10); }
export async function saveSettings(settings) { await putRecord(await db(), 'preferences', { id: 'settings', ...settings }); }
export async function loadSettings() { return await getRecord(await db(), 'preferences', 'settings'); }
export function parseFile(text) {
  if (new TextEncoder().encode(text).length > MAX_SAVE_BYTES) throw new Error('File exceeds the 96 MB limit.');
  return JSON.parse(text);
}
export function downloadJson(value, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
