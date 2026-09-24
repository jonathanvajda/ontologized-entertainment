import { applyDelta, assertDefaultGraph, cloneStore, invertDelta } from './rdf-store.js';
import { success, failure, asFailure } from './result.js';

export class ActionEngine {
  constructor({ store, rules, validator, transactions, random, project = null, maxTriggerDepth = 16, now = () => new Date().toISOString(), id = defaultId }) {
    Object.assign(this, { store, rules, validator, transactions, random, project, maxTriggerDepth, now, id });
  }
  async propose(action, context = {}, depth = 0) {
    if (!action?.actionType) return failure('INVALID_ACTION', 'An actionType is required.');
    if (depth > this.maxTriggerDepth) return failure('TRIGGER_DEPTH_EXCEEDED', 'Triggered-effect recursion limit exceeded.');
    const handler = this.rules.action(action.actionType);
    if (!handler) return failure('UNKNOWN_ACTION', `No handler is registered for ${action.actionType}.`);
    let rngStateBefore = null;
    try {
      for (const precondition of handler.preconditions || []) {
        const result = await precondition({ action, store: this.store, random: this.random, context });
        if (result === false || result?.ok === false) return result?.ok === false ? result : failure('ILLEGAL_ACTION', 'An action precondition failed.');
      }
      rngStateBefore = this.random?.getState?.() ?? null;
      const delta = normalizeDelta(await handler.effects({ action, store: this.store, random: this.random, context }));
      assertDefaultGraph([...delta.additions, ...delta.removals]);
      const candidate = applyDelta(cloneStore(this.store), delta);
      const validation = await this.validator.validate(candidate, { action, context });
      if (!validation.ok) {
        if (rngStateBefore != null) this.random?.setState?.(rngStateBefore);
        return validation;
      }
      try { applyDelta(this.store, delta); }
      catch (error) {
        try { applyDelta(this.store, invertDelta(delta)); } catch { /* Preserve the original store error. */ }
        throw error;
      }
      const record = this.transactions.append({
        id: this.id('tx'), actionIri: action.actionIri || null, action: { ...action, clientContext: undefined },
        timestamp: this.now(), delta, rngStateBefore, rngStateAfter: this.random?.getState?.() ?? null
      });
      const projection = this.project?.(this.store, context) || null;
      const effects = [];
      for (const trigger of this.rules.triggers(action.actionType)) {
        const proposals = await trigger({ action, store: this.store, projection, context }) || [];
        for (const proposal of [].concat(proposals)) effects.push(await this.propose(proposal, context, depth + 1));
      }
      const consequences = [];
      for (const consequence of this.rules.consequences()) consequences.push(await consequence({ action, store: this.store, projection, context, record }));
      const endConditions = [];
      for (const condition of this.rules.endConditions()) {
        const result = await condition({ action, store: this.store, projection, context, record });
        if (result) endConditions.push(result);
      }
      return success({ transaction: record, projection, triggeredEffects: effects, consequences, endConditions });
    } catch (error) {
      if (rngStateBefore != null) this.random?.setState?.(rngStateBefore);
      return asFailure(error);
    }
  }
}

function normalizeDelta(value = {}) { return { additions: [...(value.additions || [])], removals: [...(value.removals || [])] }; }
let fallbackId = 0;
function defaultId(prefix) { return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${fallbackId += 1}`}`; }
