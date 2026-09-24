import { failure, success } from './result.js';

export const SAVE_FORMAT_VERSION = 1;

export function createSavePackage({ game, engineVersion = '0.1.0', schemaVersion, state, transactions = [], rngState = null, uiState, now = () => new Date().toISOString() }) {
  if (!game?.id || !game?.version || !schemaVersion || typeof state !== 'string') throw new TypeError('game id/version, schemaVersion, and serialized RDF state are required.');
  return {
    manifest: { gameId: game.id, gameVersion: game.version, engineVersion, schemaVersion, saveFormatVersion: SAVE_FORMAT_VERSION, timestamp: now(), rngState, compatibilityFlags: [] },
    state,
    transactions,
    ...(uiState === undefined ? {} : { uiState })
  };
}

export function validateSavePackage(value, { gameId, maxBytes = 5_000_000 } = {}) {
  if (!value || typeof value !== 'object') return failure('INVALID_SAVE', 'Save package must be an object.');
  if (value.manifest?.saveFormatVersion !== SAVE_FORMAT_VERSION) return failure('UNSUPPORTED_SAVE_VERSION', 'The save format version is unsupported.');
  if (gameId && value.manifest.gameId !== gameId) return failure('WRONG_GAME', 'The save belongs to a different game.');
  if (typeof value.state !== 'string' || new Blob([value.state]).size > maxBytes) return failure('INVALID_RDF_STATE', 'Serialized RDF state is missing or too large.');
  if (!Array.isArray(value.transactions)) return failure('INVALID_TRANSACTIONS', 'Transaction history must be an array.');
  return success(value);
}

export function exportSaveJson(savePackage) { return JSON.stringify(savePackage, null, 2); }
export function importSaveJson(text, options) {
  try { return validateSavePackage(JSON.parse(text), options); }
  catch (error) { return failure('MALFORMED_SAVE', 'Save JSON could not be parsed.', { message: error.message }); }
}
