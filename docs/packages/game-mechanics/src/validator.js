import { success, failure } from './result.js';

export class Validator {
  #validators = [];
  constructor(validators = []) { validators.forEach((item) => this.register(item)); }
  register(validator, { id = validator.name || 'anonymous', severity = 'violation' } = {}) {
    if (typeof validator !== 'function') throw new TypeError('Validator must be a function.');
    this.#validators.push({ id, severity, validate: validator });
    return this;
  }
  async validate(store, context = {}) {
    const findings = [];
    for (const entry of this.#validators) {
      const result = await entry.validate(store, context);
      const values = Array.isArray(result) ? result : result ? [result] : [];
      findings.push(...values.map((finding) => ({ severity: entry.severity, validatorId: entry.id, ...finding })));
    }
    const blocking = findings.filter((item) => item.severity === 'violation');
    return blocking.length
      ? failure('INVALID_STATE', 'Candidate RDF state violates one or more invariants.', { findings })
      : success({ findings });
  }
}
