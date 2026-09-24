import { RandomEngine, RdfStore, Validator, createGameEngine } from '../packages/game-mechanics/src/index.js';

const status = document.querySelector('#engine-status');
const output = document.querySelector('#check-output');
const button = document.querySelector('#run-check');

status.textContent = 'All shared engine modules loaded. No game-specific state has been created.';

button.addEventListener('click', () => {
  const first = new RandomEngine('capability-check');
  const second = new RandomEngine('capability-check');
  const rolls = Array.from({ length: 4 }, () => first.rollDie(6));
  const matching = Array.from({ length: 4 }, () => second.rollDie(6));
  const engine = createGameEngine({ store: new RdfStore(), validator: new Validator(), seed: 'capability-check' });
  output.textContent = rolls.join(', ') === matching.join(', ') && engine.store.size === 0
    ? `Passed: seeded rolls repeat as ${rolls.join(', ')} and canonical RDF remains isolated.`
    : 'The deterministic check failed.';
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {
    status.textContent += ' Offline caching is unavailable in this browser session.';
  });
}
