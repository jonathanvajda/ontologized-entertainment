export class ScoreEngine {
  #rules = [];
  constructor(rules = []) { this.#rules = [...rules]; }
  register(rule) { this.#rules.push(rule); return this; }
  calculate(context) {
    const scores = new Map();
    for (const rule of this.#rules) {
      const values = rule(context) || {};
      for (const [player, amount] of values instanceof Map ? values : Object.entries(values)) {
        scores.set(player, (scores.get(player) || 0) + Number(amount || 0));
      }
    }
    return scores;
  }
  rank(scores, tieBreaker = null) {
    return [...scores].sort((a, b) => (b[1] - a[1]) || (tieBreaker ? tieBreaker(a, b) : String(a[0]).localeCompare(String(b[0]))));
  }
}
