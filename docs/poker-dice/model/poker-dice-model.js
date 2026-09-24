import { createGameEngine, RdfStore, RuleRegistry, Validator, namedNode, literal, quad } from '../../packages/game-mechanics/src/index.js';
import { CATEGORIES, STANDARD_PROFILE } from '../game-config.js';
import { calculateTotals, previewScores, rankPlayers, scoreCategory, solitaireBand } from '../rules/scoring.js';
import { NS, V, XSD, iri } from './vocabulary.js';

const nn = namedNode;
const q = (s, p, o) => quad(nn(s), nn(p), typeof o === 'string' ? nn(o) : o);
const int = (value) => literal(value, XSD + 'integer');
const bool = (value) => literal(value, XSD + 'boolean');
const text = (value) => literal(value);
const SESSION = iri('session');
const POOL = iri('dice-pool');

export function createPokerDiceGame({ names = ['Player 1'], seed = Date.now(), mode = names.length === 1 ? 'solitaire' : 'multiplayer' } = {}) {
  const normalized = names.map((name) => String(name).trim()).filter(Boolean);
  if (normalized.length < 1 || normalized.length > 6) throw new RangeError('Poker Dice requires one to six players.');
  const quads = [
    q(SESSION, V.type, V.GameSession), q(SESSION, V.mode, text(mode)), q(SESSION, V.phase, text('awaiting-roll')),
    q(SESSION, V.round, int(1)), q(SESSION, V.turn, int(1)), q(SESSION, V.rollCount, int(0)), q(SESSION, V.complete, bool(false)),
    q(POOL, V.type, V.DicePool)
  ];
  normalized.forEach((name, index) => {
    const player = iri(`player-${index + 1}`); const card = iri(`scorecard-${index + 1}`);
    quads.push(q(player, V.type, V.Player), q(player, V.label, text(name)), q(player, V.playerOrder, int(index)), q(player, V.hasScorecard, card), q(card, V.type, V.Scorecard), q(SESSION, V.hasPlayer, player));
  });
  quads.push(q(SESSION, V.currentPlayer, iri('player-1')));
  for (let index = 1; index <= 5; index += 1) { const die = iri(`die-${index}`); quads.push(q(die, V.type, V.PokerDie), q(die, V.memberOf, POOL)); }
  return hydratePokerDiceGame({ quads, seed });
}

export function hydratePokerDiceGame({ quads, seed, rngState = null, transactions = [] }) {
  const store = new RdfStore(quads); const rules = createRules(); const validator = new Validator([validateState]);
  const engine = createGameEngine({ store, rules, validator, seed, projection: projectPokerDice });
  if (rngState != null) engine.random.setState(rngState);
  if (transactions.length) engine.transactions.restore(transactions);
  return {
    engine,
    state: () => projectPokerDice(store),
    act: (actionType, parameters = {}) => engine.actions.propose({ actionType, actorIri: projectPokerDice(store).currentPlayerIri, parameters }),
    snapshot: () => ({ quads: store.getQuads(), rngState: engine.random.getState(), transactions: engine.transactions.entries() })
  };
}

function createRules() {
  return new RuleRegistry()
    .registerAction('rollDice', { preconditions: [canRoll], effects: rollEffects })
    .registerAction('toggleHold', { preconditions: [canToggle], effects: holdEffects })
    .registerAction('commitScore', { preconditions: [canScore], effects: scoreEffects });
}

function canCurrent({ action, store }) { return getObject(store, SESSION, V.currentPlayer) === action.actorIri || { ok: false, code: 'NOT_CURRENT_PLAYER', message: 'It is another player’s turn.' }; }
function canRoll(context) {
  const current = canCurrent(context); if (current !== true) return current;
  const state = projectPokerDice(context.store);
  return (!state.complete && ['awaiting-roll', 'selecting-dice'].includes(state.phase) && state.rollCount < 3) || { ok: false, code: 'ROLL_NOT_ALLOWED', message: 'No rolls remain in this turn.' };
}
function canToggle(context) {
  const current = canCurrent(context); if (current !== true) return current;
  const state = projectPokerDice(context.store); const die = context.action.parameters.dieIri;
  return (state.phase === 'selecting-dice' && state.dice.some((item) => item.iri === die)) || { ok: false, code: 'HOLD_NOT_ALLOWED', message: 'Dice can be held only between rolls.' };
}
function canScore(context) {
  const current = canCurrent(context); if (current !== true) return current;
  const state = projectPokerDice(context.store); const category = context.action.parameters.categoryId;
  return (state.rollCount > 0 && ['selecting-dice', 'must-score'].includes(state.phase) && CATEGORIES.some((item) => item.id === category) && state.players.find((p) => p.iri === state.currentPlayerIri).scores[category] === undefined)
    || { ok: false, code: 'SCORE_NOT_ALLOWED', message: 'That score category is unavailable.' };
}

function rollEffects({ store, random }) {
  const state = projectPokerDice(store); const rollNumber = state.rollCount + 1; const rollIri = iri(`roll-${state.turnNumber}-${rollNumber}-${store.size}`);
  const additions = [q(rollIri, V.type, V.DiceRollingAct), q(rollIri, V.performedBy, state.currentPlayerIri)]; const removals = literalsFor(store, SESSION, V.rollCount).concat(literalsFor(store, SESSION, V.phase));
  for (const die of state.dice.sort((a, b) => a.iri.localeCompare(b.iri))) {
    if (state.rollCount > 0 && die.held) continue;
    const result = iri(`face-${state.turnNumber}-${rollNumber}-${die.iri.split('-').at(-1)}-${store.size}`);
    additions.push(q(result, V.type, V.DieFaceValue), q(result, V.value, int(random.randomInt(1, 6))), q(die.iri, V.hasCurrentFace, result), q(rollIri, V.hasResult, result));
    const old = store.getQuads(nn(die.iri), nn(V.hasCurrentFace), null, null); removals.push(...old);
  }
  additions.push(q(SESSION, V.rollCount, int(rollNumber)), q(SESSION, V.phase, text(rollNumber === 3 ? 'must-score' : 'selecting-dice')));
  return { additions, removals };
}

function holdEffects({ action, store }) {
  const die = action.parameters.dieIri; const player = getObject(store, SESSION, V.currentPlayer); const existing = store.getQuads(nn(die), nn(V.heldBy), null, null);
  return existing.length ? { additions: [], removals: existing } : { additions: [q(die, V.heldBy, player)], removals: [] };
}

function scoreEffects({ action, store }) {
  const state = projectPokerDice(store); const player = state.players.find((item) => item.iri === state.currentPlayerIri); const category = action.parameters.categoryId;
  const value = scoreCategory(category, state.dice.map((die) => die.value)); const entry = iri(`score-${player.order + 1}-${category}`);
  const additions = [q(entry, V.type, V.ScoreEntry), q(entry, V.forCategory, iri(`category-${category}`)), q(entry, V.value, int(value)), q(player.scorecardIri, V.hasScoreEntry, entry)];
  const removals = [...store.getQuads(null, nn(V.heldBy), null, null), ...literalsFor(store, SESSION, V.phase), ...literalsFor(store, SESSION, V.rollCount), ...literalsFor(store, SESSION, V.turn), ...literalsFor(store, SESSION, V.round), ...store.getQuads(nn(SESSION), nn(V.currentPlayer), null, null), ...literalsFor(store, SESSION, V.complete)];
  const complete = state.players.every((item) => item.iri === player.iri ? Object.keys(item.scores).length + 1 === CATEGORIES.length : Object.keys(item.scores).length === CATEGORIES.length);
  let nextIndex = state.currentPlayerIndex; let round = state.roundNumber;
  if (!complete) { nextIndex = (nextIndex + 1) % state.players.length; if (nextIndex === 0) round += 1; }
  additions.push(q(SESSION, V.complete, bool(complete)), q(SESSION, V.phase, text(complete ? 'complete' : 'awaiting-roll')), q(SESSION, V.rollCount, int(0)), q(SESSION, V.turn, int(state.turnNumber + 1)), q(SESSION, V.round, int(round)), q(SESSION, V.currentPlayer, state.players[nextIndex].iri));
  return { additions, removals };
}

export function projectPokerDice(store) {
  const playerIris = store.getQuads(nn(SESSION), nn(V.hasPlayer), null, null).map((item) => item.object.value);
  const players = playerIris.map((playerIri) => {
    const scorecardIri = getObject(store, playerIri, V.hasScorecard); const scores = {};
    for (const relation of store.getQuads(nn(scorecardIri), nn(V.hasScoreEntry), null, null)) {
      const entry = relation.object.value; const category = getObject(store, entry, V.forCategory).replace(iri('category-'), ''); scores[category] = getNumber(store, entry, V.value);
    }
    return { iri: playerIri, name: getLiteral(store, playerIri, V.label), order: getNumber(store, playerIri, V.playerOrder), scorecardIri, scores, totals: calculateTotals(scores) };
  }).sort((a, b) => a.order - b.order);
  const currentPlayerIri = getObject(store, SESSION, V.currentPlayer); const currentPlayerIndex = players.findIndex((item) => item.iri === currentPlayerIri);
  const dice = store.getQuads(null, nn(V.type), nn(V.PokerDie), null).map((item) => {
    const dieIri = item.subject.value; const faceIri = getObject(store, dieIri, V.hasCurrentFace, null);
    return { iri: dieIri, value: faceIri ? getNumber(store, faceIri, V.value) : null, held: store.getQuads(nn(dieIri), nn(V.heldBy), null, null).length > 0 };
  }).sort((a, b) => a.iri.localeCompare(b.iri));
  const phase = getLiteral(store, SESSION, V.phase); const rollCount = getNumber(store, SESSION, V.rollCount); const complete = getLiteral(store, SESSION, V.complete) === 'true';
  const active = players[currentPlayerIndex];
  return { mode: getLiteral(store, SESSION, V.mode), players, currentPlayerIri, currentPlayerIndex, roundNumber: getNumber(store, SESSION, V.round), turnNumber: getNumber(store, SESSION, V.turn), phase, rollCount, complete, dice,
    previews: rollCount ? previewScores(dice.map((die) => die.value), active.scores) : {}, ranking: complete ? rankPlayers(players) : [], achievement: complete && players.length === 1 ? solitaireBand(players[0].totals.grand) : null,
    legalActions: complete ? [] : phase === 'awaiting-roll' ? ['rollDice'] : phase === 'selecting-dice' ? ['toggleHold', 'rollDice', 'commitScore'] : ['commitScore'] };
}

function validateState(store) {
  const state = projectPokerDice(store); const findings = [];
  if (state.players.length < 1 || state.players.length > 6) findings.push({ message: 'Player count must be 1–6.' });
  if (state.dice.length !== 5) findings.push({ message: 'The standard profile requires five dice.' });
  if (state.rollCount < 0 || state.rollCount > 3) findings.push({ message: 'Roll count must be 0–3.' });
  if (state.dice.some((die) => die.value != null && (die.value < 1 || die.value > 6))) findings.push({ message: 'Die values must be 1–6.' });
  if (state.players.some((player) => Object.keys(player.scores).some((id) => !CATEGORIES.some((category) => category.id === id)))) findings.push({ message: 'Unknown score category.' });
  return findings;
}

function getObject(store, subject, predicate, fallback = '') { return store.getQuads(nn(subject), nn(predicate), null, null)[0]?.object.value ?? fallback; }
function getLiteral(store, subject, predicate, fallback = '') { return getObject(store, subject, predicate, fallback); }
function getNumber(store, subject, predicate) { return Number(getLiteral(store, subject, predicate, '0')); }
function literalsFor(store, subject, predicate) { return store.getQuads(nn(subject), nn(predicate), null, null); }

export function serializeSnapshot(game) { return JSON.stringify({ format: 'poker-dice-save', version: 1, ...game.snapshot() }, null, 2); }
export function parseSnapshot(textValue) {
  const data = JSON.parse(textValue); if (data.format !== 'poker-dice-save' || data.version !== 1 || !Array.isArray(data.quads)) throw new Error('Unsupported Poker Dice save.');
  return hydratePokerDiceGame(data);
}
