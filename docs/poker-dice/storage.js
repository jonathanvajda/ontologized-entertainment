import { createGameDatabase, getRecord, putRecord } from '../packages/game-mechanics/src/index.js';

const SAVE_ID = 'poker-dice-autosave';

export async function saveLocal(serialized) {
  const db = await createGameDatabase(); await putRecord(db, 'saveStates', { id: SAVE_ID, gameId: 'poker-dice', updatedAt: new Date().toISOString(), serialized }); db.close();
}
export async function loadLocal() {
  const db = await createGameDatabase(); const record = await getRecord(db, 'saveStates', SAVE_ID); db.close(); return record?.serialized || null;
}
export function downloadSave(serialized) {
  const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' })); const link = document.createElement('a');
  link.href = url; link.download = `poker-dice-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
