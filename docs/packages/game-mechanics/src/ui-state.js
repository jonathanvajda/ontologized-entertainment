export function createUiState(initial = {}) {
  let value = { selectedIri: null, hoveredIri: null, modal: null, zoom: 1, pan: { x: 0, y: 0 }, dragging: null, reducedMotion: false, ...initial };
  const listeners = new Set();
  return {
    get: () => structuredClone(value),
    set(patch) { value = { ...value, ...patch }; listeners.forEach((listener) => listener(structuredClone(value))); return value; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  };
}
