export class RuleRegistry {
  #actions = new Map();
  #triggers = new Map();
  #endConditions = [];
  #consequences = [];

  registerAction(actionType, handler) {
    if (!actionType || typeof handler?.effects !== 'function') throw new TypeError('An action handler requires a type and effects function.');
    this.#actions.set(actionType, { preconditions: [], ...handler });
    return this;
  }
  action(actionType) { return this.#actions.get(actionType) || null; }
  actionTypes() { return [...this.#actions.keys()]; }
  registerTrigger(actionType, trigger) {
    if (typeof trigger !== 'function') throw new TypeError('A trigger must be a function.');
    this.#triggers.set(actionType, [...(this.#triggers.get(actionType) || []), trigger]);
    return this;
  }
  triggers(actionType) { return [...(this.#triggers.get(actionType) || [])]; }
  registerEndCondition(condition) { this.#endConditions.push(condition); return this; }
  endConditions() { return [...this.#endConditions]; }
  registerConsequence(consequence) {
    if (typeof consequence !== 'function') throw new TypeError('A consequence must be a function.');
    this.#consequences.push(consequence); return this;
  }
  consequences() { return [...this.#consequences]; }
}
