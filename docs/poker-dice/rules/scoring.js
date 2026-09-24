import { CATEGORIES, STANDARD_PROFILE } from '../game-config.js';

const UPPER_FACE = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };

export function scoreCategory(categoryId, dice) {
  assertDice(dice);
  const counts = frequency(dice);
  const values = [...counts.values()].sort((a, b) => b - a);
  const total = dice.reduce((sum, value) => sum + value, 0);
  if (UPPER_FACE[categoryId]) return (counts.get(UPPER_FACE[categoryId]) || 0) * UPPER_FACE[categoryId];
  if (categoryId === 'three-kind') return values[0] >= 3 ? total : 0;
  if (categoryId === 'four-kind') return values[0] >= 4 ? total : 0;
  if (categoryId === 'full-house') return values.length === 2 && values[0] === 3 && values[1] === 2 ? 25 : 0;
  if (categoryId === 'small-straight') return hasRun(dice, 4) ? 30 : 0;
  if (categoryId === 'large-straight') return hasRun(dice, 5) ? 40 : 0;
  if (categoryId === 'five-kind') return values[0] === 5 ? 50 : 0;
  if (categoryId === 'choice') return total;
  throw new RangeError(`Unknown scoring category: ${categoryId}`);
}

export function previewScores(dice, committed = {}) {
  return Object.fromEntries(CATEGORIES.filter(({ id }) => committed[id] === undefined).map(({ id }) => [id, scoreCategory(id, dice)]));
}

export function calculateTotals(scores = {}) {
  const upper = Object.keys(UPPER_FACE).reduce((sum, id) => sum + Number(scores[id] || 0), 0);
  const bonus = upper >= STANDARD_PROFILE.upperBonusThreshold ? STANDARD_PROFILE.upperBonusScore : 0;
  const categories = CATEGORIES.reduce((sum, { id }) => sum + Number(scores[id] || 0), 0);
  return { upper, bonus, grand: categories + bonus, positive: Object.values(scores).filter((value) => value > 0).length };
}

export function rankPlayers(players) {
  const ranked = players.map((player) => ({ ...player, totals: calculateTotals(player.scores) }))
    .sort((a, b) => b.totals.grand - a.totals.grand || b.totals.upper - a.totals.upper || b.totals.positive - a.totals.positive);
  let rank = 0;
  return ranked.map((player, index) => {
    const prior = ranked[index - 1];
    if (!prior || player.totals.grand !== prior.totals.grand || player.totals.upper !== prior.totals.upper || player.totals.positive !== prior.totals.positive) rank = index + 1;
    return { ...player, rank };
  });
}

export function solitaireBand(score) {
  if (score >= 300) return 'Master'; if (score >= 250) return 'Expert';
  if (score >= 200) return 'Skilled'; if (score >= 150) return 'Competent'; return 'Novice';
}

function frequency(dice) { const map = new Map(); dice.forEach((value) => map.set(value, (map.get(value) || 0) + 1)); return map; }
function hasRun(dice, length) {
  const unique = [...new Set(dice)].sort((a, b) => a - b);
  let run = 1;
  for (let i = 1; i < unique.length; i += 1) { run = unique[i] === unique[i - 1] + 1 ? run + 1 : 1; if (run >= length) return true; }
  return length <= 1;
}
function assertDice(dice) {
  if (!Array.isArray(dice) || dice.length !== 5 || dice.some((value) => !Number.isInteger(value) || value < 1 || value > 6)) throw new TypeError('Scoring requires five values from 1 through 6.');
}
