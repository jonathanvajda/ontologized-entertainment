/** UI-neutral lifecycle for pass-and-play reveal/hide screens. */
export function createPrivacyScreen({ concealOnBlur = true, maxRevealMs = 30_000, now = () => Date.now() } = {}) {
  let state = { status: 'concealed', viewerIri: null, revealedAt: null }; const listeners = new Set(); let timer = null;
  const publish = () => listeners.forEach((listener) => listener({ ...state }));
  const conceal = () => { if (timer) clearTimeout(timer); timer = null; state = { status: 'concealed', viewerIri: null, revealedAt: null }; publish(); return state; };
  return {
    getState: () => ({ ...state }),
    reveal(viewerIri, { userConfirmed = false } = {}) {
      if (!viewerIri || !userConfirmed) throw new Error('A confirmed viewer is required before revealing private information.');
      if (timer) clearTimeout(timer); state = { status: 'revealed', viewerIri, revealedAt: now() };
      if (maxRevealMs > 0) timer = setTimeout(conceal, maxRevealMs); publish(); return { ...state };
    },
    conceal,
    handleVisibilityChange(hidden) { if (concealOnBlur && hidden) conceal(); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    dispose() { if (timer) clearTimeout(timer); listeners.clear(); }
  };
}
