import { ActionEngine } from './action-engine.js';
import { RandomEngine } from './random-engine.js';
import { RuleRegistry } from './rule-registry.js';
import { Validator } from './validator.js';
import { TransactionLog } from './transaction-log.js';
import { createProjection } from './state-projector.js';

export function createGameEngine({ store, vocabulary = {}, seed, rules = new RuleRegistry(), validator = new Validator(), transactions = new TransactionLog(), projection = createProjection, ...options }) {
  const random = options.random || new RandomEngine(seed);
  let operationalState = projection(store, vocabulary);
  const actions = new ActionEngine({ store, rules, validator, transactions, random, project: (nextStore) => (operationalState = projection(nextStore, vocabulary)), ...options });
  return {
    store, rules, validator, transactions, random, actions,
    getOperationalState: () => operationalState,
    rebuildProjection: () => (operationalState = projection(store, vocabulary)),
    undo() {
      const result = transactions.undo(store);
      if (result.ok) { if (result.value.rngStateBefore != null) random.setState(result.value.rngStateBefore); operationalState = projection(store, vocabulary); }
      return result;
    },
    redo() {
      const result = transactions.redo(store);
      if (result.ok) { if (result.value.rngStateAfter != null) random.setState(result.value.rngStateAfter); operationalState = projection(store, vocabulary); }
      return result;
    }
  };
}
