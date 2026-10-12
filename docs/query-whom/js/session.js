import { createGameEngine, RuleRegistry, Validator, TransactionLog, createSavePackage, validateSavePackage } from '../../packages/game-mechanics/src/index.js';
import { quadKey } from '../../packages/game-mechanics/src/rdf-store.js';
import { parseRdfTextWithN3, serializeRdfDatasetWithN3 } from '../../packages/rdf-io/src/n3-adapter.js';
import { normalizeQuad } from '../../packages/rdf-io/src/rdf-model.js';
import { Q, TYPE, BEARER, personIri, prefixes } from './vocabulary.js';
import { decodeGame, reconstructBoard, eligibleTargets, privateChoice, HashRandom, DECK_VERSION } from './protocol.js';

const ACTIVE = Q('ActiveCandidateRole'), ELIMINATED = Q('EliminatedCandidateRole');
const SESSION_PREFIX = Q('session/');
const NAME_PATTERN = /^https:\/\/w3id\.org\/ontologized-entertainment\/query-whom\/session\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const literalProps = new Set(['gameCode', 'playerRole', 'createdAt', 'targetRevealed'].map(Q));
const actTypes = ['CreateSessionAct', 'RevealTargetAct', 'EliminateCandidateAct', 'RestoreCandidateAct'].map(Q);
const SESSION_PREDICATES = new Set([TYPE, BEARER, ...literalProps, ...['boardIncludes', 'hasOwnTarget', 'inSession', 'actInSession', 'affectsPerson', 'actionSequence'].map(Q)]);
const sameQuads = (a, b) => {
  const x = new Set(a.map(quadKey)), y = new Set(b.map(quadKey));
  return x.size === y.size && [...x].every(key => y.has(key));
};
export const isSessionQuad = q => q.subject.value.startsWith(SESSION_PREFIX) || q.predicate.value === BEARER && q.object.value.startsWith(SESSION_PREFIX);

export class QueryWhomSession {
  constructor({ N3, baseStore, manifest, definition, board, sessionIri, store, transactions = [] }) {
    Object.assign(this, { N3, baseStore, manifest, definition, board, sessionIri });
    this.df = N3.DataFactory;
    this.pending = Promise.resolve();
    this.baseline = baseStore.getQuads(null, null, null, null);
    const rules = new RuleRegistry();
    for (const actionType of ['createSession', 'revealTarget', 'eliminateCandidate', 'restoreCandidate']) rules.registerAction(actionType, {
      preconditions: [({ action, store: current }) => this.legality(action, current)],
      effects: ({ action, store: current }) => this.effects(action, current)
    });
    const validator = new Validator([current => this.validate(current)]);
    this.engine = createGameEngine({ store: store || new N3.Store(this.baseline), rules, validator,
      transactions: new TransactionLog(transactions), random: new HashRandom(definition.seed), projection: current => this.project(current) });
  }
  objects(store, s, p) { return store.getQuads(s, p, null, null).map(q => q.object.value); }
  one(store, s, p) { const values = this.objects(store, s, p); return values.length === 1 ? values[0] : null; }
  roleIri(id) { return `${this.sessionIri}/candidate-${id}`; }
  project(store = this.engine.store) {
    const ownIri = this.one(store, this.sessionIri, Q('hasOwnTarget'));
    return {
      sessionIri: this.sessionIri, code: this.one(store, this.sessionIri, Q('gameCode')),
      playerRole: this.one(store, this.sessionIri, Q('playerRole')),
      revealed: this.one(store, this.sessionIri, Q('targetRevealed')) === 'true',
      ownTargetId: this.board.find(id => personIri(id) === ownIri) ?? null,
      cards: this.board.map(id => ({ id, own: personIri(id) === ownIri,
        active: this.one(store, this.roleIri(id), TYPE) === ACTIVE }))
    };
  }
  legality(action, store) {
    const view = this.project(store);
    if (action.actionType === 'createSession') return !view.code && ['creator', 'joiner'].includes(action.parameters?.playerRole)
      && eligibleTargets(this.board, action.parameters.playerRole).includes(action.parameters.ownTargetId);
    if (!view.code) return false;
    if (action.actionType === 'revealTarget') return !view.revealed;
    const id = action.parameters?.personId;
    const card = view.cards.find(card => card.id === id);
    return Boolean(view.revealed && card && !card.own && (action.actionType === 'eliminateCandidate' ? card.active : !card.active));
  }
  effects(action, store) {
    const { namedNode: n, literal: l, quad: q } = this.df;
    const add = [], remove = [], root = n(this.sessionIri);
    const triple = (s, p, o) => q(n(s), n(p), o);
    if (action.actionType === 'createSession') {
      add.push(q(root, n(TYPE), n(Q('QueryWhomSession'))), q(root, n(Q('gameCode')), l(this.definition.code)),
        q(root, n(Q('playerRole')), l(action.parameters.playerRole)), q(root, n(Q('createdAt')), l(new Date().toISOString(), n(prefixes.xsd + 'dateTime'))),
        q(root, n(Q('targetRevealed')), l('false', n(prefixes.xsd + 'boolean'))), q(root, n(Q('hasOwnTarget')), n(personIri(action.parameters.ownTargetId))));
      for (const id of this.board) add.push(q(root, n(Q('boardIncludes')), n(personIri(id))),
        triple(personIri(id), BEARER, n(this.roleIri(id))), triple(this.roleIri(id), TYPE, n(ACTIVE)), triple(this.roleIri(id), Q('inSession'), root));
    } else {
      const id = action.actionType === 'revealTarget' ? this.project(store).ownTargetId : action.parameters.personId;
      const role = this.roleIri(id), old = action.actionType === 'restoreCandidate' ? ELIMINATED : ACTIVE, next = old === ACTIVE ? ELIMINATED : ACTIVE;
      remove.push(triple(role, TYPE, n(old))); add.push(triple(role, TYPE, n(next)));
      if (action.actionType === 'revealTarget') { remove.push(q(root, n(Q('targetRevealed')), l('false', n(prefixes.xsd + 'boolean')))); add.push(q(root, n(Q('targetRevealed')), l('true', n(prefixes.xsd + 'boolean')))); }
    }
    const sequence = store.getQuads(null, n(Q('actionSequence')), null, null).length + 1;
    const act = `${this.sessionIri}/act-${sequence}`;
    const actType = { createSession: 'CreateSessionAct', revealTarget: 'RevealTargetAct', eliminateCandidate: 'EliminateCandidateAct', restoreCandidate: 'RestoreCandidateAct' }[action.actionType];
    add.push(triple(act, TYPE, n(Q(actType))), triple(act, Q('actInSession'), root), triple(act, Q('actionSequence'), l(String(sequence), n(prefixes.xsd + 'positiveInteger'))));
    const id = action.actionType === 'createSession' ? null : action.actionType === 'revealTarget' ? this.project(store).ownTargetId : action.parameters.personId;
    if (id) add.push(triple(act, Q('affectsPerson'), n(personIri(id))));
    // The shared JSON transaction log must receive plain RDF/JS terms, not N3 prototype getters.
    return { additions: add.map(normalizeQuad), removals: remove.map(normalizeQuad) };
  }
  validate(store) {
    const violation = message => [{ code: 'SESSION_INVARIANT', message }];
    try {
      if (!NAME_PATTERN.test(this.sessionIri)) return violation('Invalid session identifier.');
      const quads = store.getQuads(null, null, null, null);
      if (quads.some(q => q.graph.termType !== 'DefaultGraph')) return violation('Named graphs are outside this game model.');
      if (!sameQuads(quads.filter(q => !isSessionQuad(q)), this.baseline)) return violation('Catalog or schema was changed.');
      const session = quads.filter(isSessionQuad), roles = new Set(this.board.map(id => this.roleIri(id)));
      const history = new Set(session.filter(q => q.predicate.value === Q('actInSession')).map(q => q.subject.value));
      for (const quad of session) {
        const s = quad.subject.value, p = quad.predicate.value, o = quad.object;
        if (!SESSION_PREDICATES.has(p)) return violation('Unknown session predicate.');
        if ([BEARER, Q('inSession'), Q('actInSession')].includes(p) && o.termType !== 'NamedNode') return violation('Object relations require individual IRIs.');
        if (s !== this.sessionIri && !roles.has(s) && !history.has(s) && !(p === BEARER && this.board.some(id => personIri(id) === s))) return violation('Unexpected session subject.');
        if (history.has(s) && (!s.startsWith(this.sessionIri + '/act-') || !/\/act-[1-9]\d*$/.test(s))) return violation('Invalid action identifier.');
        if (literalProps.has(p) && (s !== this.sessionIri || o.termType !== 'Literal')) return violation('Invalid session metadata.');
        if (p === TYPE && (o.termType !== 'NamedNode' || (s === this.sessionIri ? o.value !== Q('QueryWhomSession') : roles.has(s) ? ![ACTIVE, ELIMINATED].includes(o.value) : !actTypes.includes(o.value)))) return violation('Invalid session type.');
        if (p === BEARER && !this.board.some(id => s === personIri(id) && o.value === this.roleIri(id))) return violation('Invalid role bearer.');
        if (p === Q('inSession') && (!roles.has(s) || o.value !== this.sessionIri)) return violation('Invalid role scope.');
        if (p === Q('actInSession') && (!history.has(s) || o.value !== this.sessionIri)) return violation('Invalid action scope.');
        if ([Q('boardIncludes'), Q('hasOwnTarget')].includes(p) && (s !== this.sessionIri || o.termType !== 'NamedNode' || !this.board.some(id => personIri(id) === o.value))) return violation('Invalid board person.');
        if (p === Q('affectsPerson') && (!history.has(s) || o.termType !== 'NamedNode' || !this.board.some(id => personIri(id) === o.value))) return violation('Invalid action target.');
        if (p === Q('actionSequence') && (!history.has(s) || o.termType !== 'Literal' || o.datatype.value !== prefixes.xsd + 'positiveInteger' || !/^[1-9]\d*$/.test(o.value))) return violation('Invalid action sequence.');
      }
      const view = this.project(store);
      if (this.one(store, this.sessionIri, TYPE) !== Q('QueryWhomSession') || view.code !== this.definition.code || !['creator', 'joiner'].includes(view.playerRole)) return violation('Invalid session definition.');
      const reveal = this.one(store, this.sessionIri, Q('targetRevealed'));
      if (!['true', 'false'].includes(reveal) || !eligibleTargets(this.board, view.playerRole).includes(view.ownTargetId)) return violation('Invalid private assignment.');
      const metadataTypes = { gameCode: 'string', playerRole: 'string', targetRevealed: 'boolean', createdAt: 'dateTime' };
      for (const [local, datatype] of Object.entries(metadataTypes)) {
        const values = store.getQuads(this.sessionIri, Q(local), null, null);
        if (values.length !== 1 || values[0].object.datatype.value !== prefixes.xsd + datatype) return violation('Invalid metadata datatype.');
      }
      const created = this.one(store, this.sessionIri, Q('createdAt'));
      if (!created || !Number.isFinite(Date.parse(created))) return violation('Invalid creation time.');
      const members = this.objects(store, this.sessionIri, Q('boardIncludes'));
      if (members.length !== this.board.length || this.board.some(id => !members.includes(personIri(id)))) return violation('Board membership changed.');
      for (const id of this.board) {
        const role = this.roleIri(id), type = this.one(store, role, TYPE);
        if (![ACTIVE, ELIMINATED].includes(type) || this.one(store, role, Q('inSession')) !== this.sessionIri || !this.objects(store, personIri(id), BEARER).includes(role)) return violation('Candidate must have one scoped status.');
        if (!view.revealed && type !== ACTIVE || view.revealed && id === view.ownTargetId && type !== ELIMINATED) return violation('Invalid own target status.');
      }
      const sequences = [];
      for (const act of history) {
        const sequence = Number(this.one(store, act, Q('actionSequence')));
        if (!actTypes.includes(this.one(store, act, TYPE)) || this.one(store, act, Q('actInSession')) !== this.sessionIri || !Number.isSafeInteger(sequence) || act !== `${this.sessionIri}/act-${sequence}`) return violation('Invalid action history.');
        const target = this.objects(store, act, Q('affectsPerson'));
        if (this.one(store, act, TYPE) === Q('CreateSessionAct') ? sequence !== 1 || target.length !== 0 : target.length !== 1) return violation('Invalid action target cardinality.');
        sequences.push(sequence);
      }
      sequences.sort((a, b) => a - b);
      if (!sequences.length || sequences.length > 10000 || sequences.some((sequence, i) => sequence !== i + 1)) return violation('Invalid action order.');
      return [];
    } catch { return violation('Malformed session RDF.'); }
  }
  async propose(actionType, parameters = {}) {
    const operation = this.pending.then(async () => {
      const sequence = this.engine.transactions.entries().length + 1;
      if (sequence > 10000) throw new Error('This game has reached its action limit. Start a new game.');
      const result = await this.engine.actions.propose({ actionType, parameters, actionIri: `${this.sessionIri}/act-${sequence}` });
      if (!result.ok) throw new Error(result.message);
      return this.project();
    });
    this.pending = operation.catch(() => {});
    return operation;
  }
  async save(uiState = {}) {
    const quads = this.engine.store.getQuads(null, null, null, null).filter(isSessionQuad);
    const state = await serializeRdfDatasetWithN3(new this.N3.Store(quads), { format: 'turtle', prefixes, runtime: { N3: this.N3 } });
    const save = createSavePackage({ game: { id: 'query-whom', version: '1.0.0' }, schemaVersion: '1.0.0', state,
      transactions: this.engine.transactions.entries(), rngState: this.engine.random.getState(), uiState });
    save.manifest.catalogHash = this.manifest.catalogHash; save.manifest.deckVersion = DECK_VERSION; save.manifest.protocolVersion = 1;
    return save;
  }
  static async create({ N3, baseStore, manifest, code, playerRole, choose = privateChoice }) {
    const definition = await decodeGame(code), board = await reconstructBoard(definition);
    const session = new QueryWhomSession({ N3, baseStore, manifest, definition, board, sessionIri: SESSION_PREFIX + crypto.randomUUID() });
    await session.propose('createSession', { playerRole, ownTargetId: choose(eligibleTargets(board, playerRole)) });
    return session;
  }
  static async restore({ N3, baseStore, manifest, save }) {
    const result = validateSavePackage(save, { gameId: 'query-whom' });
    if (!result.ok) throw new Error(result.message);
    if (save.manifest.schemaVersion !== '1.0.0' || save.manifest.gameVersion !== '1.0.0' || save.manifest.catalogHash !== manifest.catalogHash || save.manifest.deckVersion !== DECK_VERSION || save.manifest.protocolVersion !== 1) throw new Error('This save needs a different game or catalog version.');
    if (save.transactions.length > 10000) throw new Error('Save history is too large.');
    const parsed = parseRdfTextWithN3(save.state, { format: 'turtle', runtime: { N3 } }).quads;
    if (parsed.some(q => !isSessionQuad(q) || q.graph.termType !== 'DefaultGraph')) throw new Error('Save contains non-session RDF.');
    const mutable = new N3.Store(parsed);
    const roots = mutable.getQuads(null, TYPE, Q('QueryWhomSession'), null);
    if (roots.length !== 1) throw new Error('Save must contain exactly one local session.');
    const sessionIri = roots[0].subject.value;
    const codes = mutable.getQuads(sessionIri, Q('gameCode'), null, null);
    if (codes.length !== 1) throw new Error('Save is missing its game code.');
    const definition = await decodeGame(codes[0].object.value), board = await reconstructBoard(definition);
    const store = new N3.Store(baseStore.getQuads(null, null, null, null)); store.addQuads(parsed);
    const session = new QueryWhomSession({ N3, baseStore, manifest, definition, board, sessionIri, store });
    if (JSON.stringify(save.manifest.rngState) !== JSON.stringify(session.engine.random.getState())) throw new Error('Invalid saved random state.');
    const findings = session.validate(store);
    if (findings.length) throw new Error(findings[0].message);
    // Replay through trusted handlers, rather than applying arbitrary imported deltas.
    const replay = new QueryWhomSession({ N3, baseStore, manifest, definition, board, sessionIri });
    for (let i = 0; i < save.transactions.length; i++) {
      const entry = save.transactions[i];
      if (!entry || entry.sequence !== i + 1 || !entry.action || !entry.delta || !Array.isArray(entry.delta.additions) || !Array.isArray(entry.delta.removals)) throw new Error('Invalid transaction history.');
      if (entry.actionIri !== `${sessionIri}/act-${i + 1}` || entry.action.actionIri !== entry.actionIri) throw new Error('History is missing its semantic action link.');
      const type = entry.action.actionType;
      if (i === 0 ? type !== 'createSession' : !['revealTarget', 'eliminateCandidate', 'restoreCandidate'].includes(type)) throw new Error('Unexpected historical action.');
      if (!replay.legality(entry.action, replay.engine.store)) throw new Error('History contains an illegal action.');
      const expected = replay.effects(entry.action, replay.engine.store);
      // Creation time is retained, not regenerated, during replay.
      if (i === 0) {
        const created = parsed.find(q => q.subject.value === sessionIri && q.predicate.value === Q('createdAt'));
        expected.additions = expected.additions.map(q => q.predicate.value === Q('createdAt') ? created : q);
      }
      if (!sameQuads(entry.delta.additions, expected.additions) || !sameQuads(entry.delta.removals, expected.removals)) throw new Error('History delta does not match its trusted action.');
      replay.engine.store.removeQuads(expected.removals); replay.engine.store.addQuads(expected.additions);
      if (replay.validate(replay.engine.store).length) throw new Error('History violates game invariants.');
      if (i % 20 === 19) await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (!sameQuads(parsed, replay.engine.store.getQuads(null, null, null, null).filter(isSessionQuad))) throw new Error('History does not reconstruct the saved state.');
    session.engine.transactions.restore(save.transactions);
    return session;
  }
}
