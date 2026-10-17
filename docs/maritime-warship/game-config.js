export const SHIPS = Object.freeze({
  Carrier: { label: 'Carrier', length: 5 }, Battleship: { label: 'Battleship', length: 4 },
  Cruiser: { label: 'Cruiser', length: 3 }, Submarine: { label: 'Submarine', length: 3 },
  Destroyer: { label: 'Destroyer', length: 2 }
});
export function presetFleet(count = 5) {
  const types = ['Battleship', 'Cruiser', 'Submarine', 'Destroyer'];
  if (count >= 5) types.unshift('Carrier');
  if (count >= 6) types.push('Battleship');
  if (count >= 7) types.push('Carrier');
  return types;
}
export function normalizeConfig(input = {}) {
  const config = {
    rows: input.rows ?? 10, columns: input.columns ?? 10, obstacles: input.obstacles ?? 0,
    climate: input.climate ?? 'WARM_WATER', salvo: input.salvo ?? false,
    fleet: input.fleet ?? presetFleet(5), mode: input.mode ?? 'TWO_DEVICE',
    names: input.names ?? ['Admiral One', 'Admiral Two'], budget: input.budget ?? 35
  };
  for (const key of ['rows', 'columns']) if (!Number.isInteger(config[key]) || config[key] < 8 || config[key] > 26) throw new Error('Board dimensions must be integers from 8 to 26.');
  if (!Number.isInteger(config.obstacles) || config.obstacles < 0 || config.obstacles > 4) throw new Error('Choose zero to four obstacle clusters.');
  if (!['WARM_WATER', 'ARCTIC'].includes(config.climate)) throw new Error('Choose a supported climate.');
  if (config.mode !== 'TWO_DEVICE') throw new Error('Unsupported play mode.');
  if (typeof config.salvo !== 'boolean') throw new Error('Salvo must be a boolean.');
  if (!Array.isArray(config.fleet) || config.fleet.length < 4 || config.fleet.length > 7 || config.fleet.some(type => !Object.hasOwn(SHIPS, type))) throw new Error('A fleet needs four to seven ships of supported classes.');
  if (!Number.isInteger(config.budget) || config.budget < 8 || config.budget > 35 || config.fleet.reduce((sum, type) => sum + SHIPS[type].length, 0) > config.budget) throw new Error('The fleet exceeds the draft budget (one point per segment).');
  if (!Array.isArray(config.names) || config.names.length !== 2 || config.names.some(name => typeof name !== 'string' || !name.trim() || name.trim().length > 24)) throw new Error('Enter two player names, up to 24 characters each.');
  config.names = config.names.map(name => name.trim());
  if (config.names[0].toLocaleLowerCase() === config.names[1].toLocaleLowerCase()) throw new Error('Use distinct player names.');
  return { ...config, fleet: [...config.fleet] };
}
export const coordinate = (row, column) => `${String.fromCharCode(65 + row)}${column + 1}`;
export function parseCoordinate(value, config) {
  const match = /^([A-Z])([1-9][0-9]?)$/.exec(String(value));
  if (!match) return null;
  const row = match[1].charCodeAt(0) - 65, column = Number(match[2]) - 1;
  return row < config.rows && column < config.columns ? { row, column } : null;
}
