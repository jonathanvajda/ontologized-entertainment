import test from 'node:test';
import assert from 'node:assert/strict';
import { N3, args, manifest, baseStore } from './helpers.mjs';
import { LEGACY_CATALOG_HASHES, QueryWhomSession, isSessionQuad } from '../js/session.js';
import { Q, TYPE, personIri, prefixes } from '../js/vocabulary.js';
const restore = save => QueryWhomSession.restore({ N3, manifest, baseStore, save });

test('creation, private reveal, elimination and restoration use the shared pipeline', async () => {
  const session = await QueryWhomSession.create(args), before = session.project();
  assert.equal(before.revealed,false); assert(before.cards.every(c=>c.active));
  assert.equal(session.engine.transactions.entries().length,1);
  const other = before.cards.find(c=>!c.own).id;
  await assert.rejects(session.propose('eliminateCandidate',{personId:other}));
  await session.propose('revealTarget'); assert.equal(session.project().cards.filter(c=>c.active).length,23);
  await assert.rejects(session.propose('restoreCandidate',{personId:before.ownTargetId}));
  const initial = session.project().cards;
  await session.propose('eliminateCandidate',{personId:other}); assert.equal(session.project().cards.find(c=>c.id===other).active,false);
  await session.propose('restoreCandidate',{personId:other}); assert.deepEqual(session.project().cards,initial);
  assert.deepEqual(session.validate(session.engine.store),[]);
  assert.equal(session.engine.store.countQuads(null,Q('actInSession'),session.sessionIri,null),4);
});
test('JSON save restores target, roles, preferences and replayable history', async () => {
  const session = await QueryWhomSession.create(args); await session.propose('revealTarget');
  const other = session.project().cards.find(c=>!c.own).id; await session.propose('eliminateCandidate',{personId:other});
  const save = JSON.parse(JSON.stringify(await session.save({sortMode:'name',hideEliminated:true})));
  const restored = await restore(save);
  assert.deepEqual(restored.project(),session.project()); assert.equal(save.uiState.sortMode,'name');
  assert.equal(save.transactions[0].delta.additions[0].subject.termType,'NamedNode');
  assert.equal(save.transactions[0].actionIri,session.sessionIri+'/act-1');
  assert.equal(save.transactions.length,3);
  assert(!session.definition.code.includes('ownTarget'));
  const labelOnlyPredecessor = structuredClone(save); labelOnlyPredecessor.manifest.catalogHash = [...LEGACY_CATALOG_HASHES][0];
  assert.deepEqual((await restore(labelOnlyPredecessor)).project(), session.project());
});
test('concurrent proposals serialize before legality checks',async()=> {
  const session=await QueryWhomSession.create(args); await session.propose('revealTarget');
  const personId=session.project().cards.find(c=>!c.own).id;
  const results=await Promise.allSettled([session.propose('eliminateCandidate',{personId}),session.propose('eliminateCandidate',{personId})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(session.engine.transactions.entries().length,3);
  assert.deepEqual(session.validate(session.engine.store),[]);
});
test('corrupt imports and altered history are rejected without changing baseline', async () => {
  const session = await QueryWhomSession.create(args); await session.propose('revealTarget');
  const size = baseStore.size, save = JSON.parse(JSON.stringify(await session.save()));
  const wrongVersion = structuredClone(save); wrongVersion.manifest.schemaVersion = '2'; await assert.rejects(restore(wrongVersion));
  const wrongCatalog = structuredClone(save); wrongCatalog.manifest.catalogHash = 'bad'; await assert.rejects(restore(wrongCatalog));
  const noHistory = structuredClone(save); noHistory.transactions=[]; await assert.rejects(restore(noHistory),/History/);
  const badDelta = structuredClone(save); badDelta.transactions[0].delta.additions[0].object.value=Q('Bad'); await assert.rejects(restore(badDelta),/delta/);
  const noRoles = structuredClone(save); noRoles.state=noRoles.state.replace('ActiveCandidateRole','CandidateRole'); await assert.rejects(restore(noRoles));
  const catalogEdit = structuredClone(save); catalogEdit.state += `\n<${personIri(1)}> <${prefixes.rdfs}label> "Hacked" .\n`; await assert.rejects(restore(catalogEdit));
  const namedGraph = structuredClone(save); namedGraph.state = `<${Q('graph')}> { ${save.state} }`; await assert.rejects(restore(namedGraph));
  assert.equal(baseStore.size,size);
});
test('candidate validation protects immutable catalog and exclusive role status', async () => {
  const session = await QueryWhomSession.create(args), {namedNode:n,quad:q} = N3.DataFactory;
  const broken = new N3.Store(session.engine.store.getQuads(null,null,null,null));
  broken.addQuad(q(n(session.roleIri(session.board[0])),n(TYPE),n(Q('EliminatedCandidateRole'))));
  assert(session.validate(broken).length);
  const edited = new N3.Store(session.engine.store.getQuads(null,null,null,null)); edited.removeQuads(edited.getQuads(personIri(1),Q('personNumber'),null,null));
  assert(session.validate(edited).length);
});
test('separate sessions share an unchanged catalog and never share mutable role identity', async () => {
  const a = await QueryWhomSession.create(args), b = await QueryWhomSession.create({...args,playerRole:'joiner'});
  assert.notEqual(a.project().ownTargetId,b.project().ownTargetId); assert.notEqual(a.roleIri(1),b.roleIri(1));
  await a.propose('revealTarget'); assert.equal(b.project().revealed,false);
  assert.equal(baseStore.getQuads(null,null,null,null).filter(isSessionQuad).length,0);
});
