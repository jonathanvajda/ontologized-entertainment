import {RandomEngine,RdfStore,namedNode,literal,quad,createCommitment,verifyCommitment,generateGameCode} from '../../packages/game-mechanics/src/index.js';
import {CARDS,ENTRANCES,FOYER_SITES,NS,ROOMS,SECRET_PASSAGES,START_SITES,SUSPECTS,WALKABLE_SITES,WEAPONS,adjacentSites,directionBetween,isRoom} from '../game-config.js';
import {createHandCode} from './compact-hand-code.js';

const RDF='http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const XSD='http://www.w3.org/2001/XMLSchema#';
const BFO='http://purl.obolibrary.org/obo/';
const DICE='https://w3id.org/ontologized-entertainment/game/dice/';
const SESSION=NS+'session';
const P={type:RDF+'type',value:RDF+'value',label:'http://www.w3.org/2000/01/rdf-schema#label',phase:NS+'phase',mode:NS+'mode',current:NS+'hasCurrentPlayer',turn:NS+'turnNumber',complete:NS+'complete',commitment:NS+'solutionCommitment',salt:NS+'solutionSalt',category:NS+'cardCategory',member:NS+'memberOf',owner:NS+'ownedBy',order:NS+'playerOrder',eliminated:NS+'eliminated',token:NS+'usesToken',controls:NS+'controlsPerson',represents:NS+'representsPerson',location:BFO+'BFO_0000171',die:NS+'dieResult',moves:NS+'movementAllowance',crossed:NS+'crossedIngress',visited:NS+'visitedSites',roomAccusation:NS+'roomAccusation',refuter:NS+'refutedBy',winner:NS+'winner',hasRoll:NS+'hasDieRoll',hasResult:DICE+'hasResult',performedBy:DICE+'performedBy',actor:NS+'performedBy',paceCost:NS+'paceCost',origin:NS+'originSite',destination:NS+'destinationSite',moveCount:NS+'moveCount'};
const nn=namedNode;
const lit=(v,dt=XSD+'string')=>literal(v,dt);
const q=(s,p,o)=>quad(nn(s),nn(p),typeof o==='string'?nn(o):o);
const val=(store,s,p,f='')=>store.getQuads(nn(s),nn(p),null,null)[0]?.object.value??f;

export async function createEverythingsSusGame({names,tokenIds,mode='pass-and-play',seed}={}){
  const clean=names.map(v=>String(v).trim()).filter(Boolean);
  if(clean.length<3||clean.length>6)throw new RangeError("Everything's Sus requires three to six players.");
  if(new Set(clean.map(name=>name.toLocaleLowerCase())).size!==clean.length)throw new RangeError('Player identities must be unique.');
  const selectedTokens=tokenIds??SUSPECTS.slice(0,clean.length).map(suspect=>suspect.id);
  if(selectedTokens.length!==clean.length||new Set(selectedTokens).size!==clean.length||selectedTokens.some(id=>!SUSPECTS.some(suspect=>suspect.id===id)))throw new RangeError('Each player must choose a different suspect.');

  const random=new RandomEngine(seed);
  const setupSeed=random.getState();
  const selectedParticipants=clean.map((name,index)=>({name,tokenId:selectedTokens[index]})).sort((left,right)=>left.tokenId.localeCompare(right.tokenId));
  const turnOrderRandom=new RandomEngine(`turn-order:${setupSeed}`);
  const orderedParticipants=turnOrderRandom.shuffle(selectedParticipants);
  const solution=[random.drawOne(SUSPECTS).id,random.drawOne(WEAPONS).id,random.drawOne(ROOMS).id];
  const remaining=random.shuffle(CARDS.filter(card=>!solution.includes(card.id)));
  const placementRandom=new RandomEngine(`foyer-placement:${setupSeed}`);
  const starts=placementRandom.shuffle(START_SITES);
  const commitment=await createCommitment(solution.slice().sort());
  const code=generateGameCode(6);
  const store=new RdfStore([q(SESSION,P.type,NS+'MysteryGameSession'),q(SESSION,P.mode,lit(mode)),q(SESSION,P.phase,lit('turn-start')),q(SESSION,P.turn,lit(1,XSD+'integer')),q(SESSION,P.complete,lit(false,XSD+'boolean')),q(SESSION,P.commitment,lit(commitment.digest)),q(SESSION,P.salt,lit(commitment.salt)),q(SESSION,NS+'gameCode',lit(code)),q(NS+'sealed-solution',P.type,NS+'SealedSolution')]);

  CARDS.forEach(card=>store.addQuads([q(NS+'card-'+card.id,P.type,NS+title(card.category)+'Card'),q(NS+'card-'+card.id,P.label,lit(card.label)),q(NS+'card-'+card.id,P.category,lit(card.category))]));
  ROOMS.forEach(room=>store.addQuads([q(NS+'room-'+room.id,P.type,NS+'Room'),q(NS+'room-'+room.id,P.type,BFO+'BFO_0000029'),q(NS+'room-'+room.id,P.label,lit(room.label))]));
  WALKABLE_SITES.forEach(site=>store.addQuads([q(NS+'site-'+site,P.type,NS+(FOYER_SITES.includes(site)?'FoyerSpace':'HallwaySpace')),q(NS+'site-'+site,P.type,BFO+'BFO_0000029'),q(NS+'site-'+site,P.label,lit(site))]));
  store.addQuads([q(NS+'site-reserve',P.type,NS+'BoardReserve'),q(NS+'site-reserve',P.type,BFO+'BFO_0000029'),q(NS+'site-reserve',P.label,lit('Off-board suspect reserve'))]);
  SUSPECTS.forEach((suspect)=>{const playerIndex=selectedParticipants.findIndex(player=>player.tokenId===suspect.id);const initialSite=playerIndex>=0?starts[playerIndex]:'reserve';store.addQuads([
    q(NS+'person-'+suspect.id,P.type,NS+'SuspectPerson'),q(NS+'person-'+suspect.id,P.label,lit(suspect.label)),q(NS+'person-'+suspect.id,P.location,nn(NS+'site-'+initialSite)),
    q(NS+'token-'+suspect.id,P.type,NS+'SuspectToken'),q(NS+'token-'+suspect.id,P.label,lit(suspect.label)),q(NS+'token-'+suspect.id,P.represents,nn(NS+'person-'+suspect.id))
  ])});
  WEAPONS.forEach(weapon=>store.addQuads([q(NS+'weapon-'+weapon.id,P.type,NS+'WeaponToken'),q(NS+'weapon-'+weapon.id,P.label,lit(weapon.label))]));

  const players=orderedParticipants.map((participant,index)=>({iri:NS+'player-'+(index+1),name:participant.name,order:index,tokenId:participant.tokenId,handIri:NS+'hand-'+(index+1)}));
  players.forEach(player=>store.addQuads([q(SESSION,NS+'hasPlayer',nn(player.iri)),q(player.iri,P.type,NS+'Detective'),q(player.iri,P.label,lit(player.name)),q(player.iri,P.order,lit(player.order,XSD+'integer')),q(player.iri,P.eliminated,lit(false,XSD+'boolean')),q(player.iri,P.token,nn(NS+'token-'+player.tokenId)),q(player.iri,P.controls,nn(NS+'person-'+player.tokenId)),q(player.handIri,P.type,NS+'PlayerHand'),q(player.handIri,P.owner,nn(player.iri))]));
  solution.forEach(id=>store.addQuad(q(NS+'card-'+id,P.member,nn(NS+'sealed-solution'))));
  remaining.forEach((card,index)=>store.addQuad(q(NS+'card-'+card.id,P.member,nn(players[index%players.length].handIri))));
  store.addQuad(q(SESSION,P.current,nn(players[0].iri)));
  return new EverythingsSusGame({store,random,players,solution,commitment,code});
}

export class EverythingsSusGame{
  constructor({store,random,players,solution,commitment,code}){Object.assign(this,{store,random,players,solution,commitment,code});}
  state(){
    const currentIri=val(this.store,SESSION,P.current);
    const playerStates=this.players.map(player=>({...player,eliminated:val(this.store,player.iri,P.eliminated)==='true',hand:CARDS.filter(card=>val(this.store,NS+'card-'+card.id,P.member)===player.handIri)}));
    const locations=Object.fromEntries(SUSPECTS.map(suspect=>[suspect.id,locationId(val(this.store,NS+'person-'+suspect.id,P.location))]));
    return {mode:val(this.store,SESSION,P.mode),phase:val(this.store,SESSION,P.phase),turn:Number(val(this.store,SESSION,P.turn,1)),complete:val(this.store,SESSION,P.complete)==='true',currentPlayerIri:currentIri,currentPlayerIndex:playerStates.findIndex(player=>player.iri===currentIri),players:playerStates,locations,die:Number(val(this.store,SESSION,P.die,0)),moves:Number(val(this.store,SESSION,P.moves,0)),crossedIngress:val(this.store,SESSION,P.crossed)==='true',visited:parse(val(this.store,SESSION,P.visited,'[]'))||[],roomAccusation:parse(val(this.store,SESSION,P.roomAccusation,'')),refuterIri:val(this.store,SESSION,P.refuter,''),winnerIri:val(this.store,SESSION,P.winner,''),commitment:this.commitment,code:this.code};
  }
  act(type,params={}){try{return{ok:true,value:this['_'+type](params),state:this.state()}}catch(error){return{ok:false,code:'ILLEGAL_ACTION',message:error.message}}}
  movementOptions(){
    const state=this.state();if(state.phase!=='movement')return[];
    const player=state.players[state.currentPlayerIndex];const from=state.locations[player.tokenId];const occupied=new Set(Object.entries(state.locations).filter(([id])=>id!==player.tokenId).map(([,location])=>location));const options=[];
    if(!isRoom(from))for(const destination of adjacentSites(from))options.push(this.#option({from,destination,cost:1,kind:'step',label:directionBetween(from,destination),occupied,state}));
    for(const entrance of ENTRANCES){
      if(entrance.room===from)for(const destination of entrance.sites)options.push(this.#option({from,destination,cost:entrance.cost,kind:entrance.kind,label:`Exit via ${entrance.kind}`,occupied,state,entranceId:entrance.id}));
      else if(entrance.sites?.includes(from))options.push(this.#option({from,destination:entrance.room,cost:entrance.cost,kind:entrance.kind,label:`Enter ${roomLabel(entrance.room)}`,occupied,state,entranceId:entrance.id}));
      else if(entrance.fromRoom===from)options.push(this.#option({from,destination:entrance.toRoom,cost:entrance.cost,kind:entrance.kind,label:`Enter ${roomLabel(entrance.toRoom)}`,occupied,state,entranceId:entrance.id}));
      else if(entrance.toRoom===from)options.push(this.#option({from,destination:entrance.fromRoom,cost:entrance.cost,kind:entrance.kind,label:`Enter ${roomLabel(entrance.fromRoom)}`,occupied,state,entranceId:entrance.id}));
    }
    return options;
  }
  #option({destination,cost,kind,label,occupied,state,entranceId=''}){let reason='';if(state.visited.includes(destination))reason='Already visited';else if(!isRoom(destination)&&occupied.has(destination))reason='Occupied';else if(kind!=='step'&&state.crossedIngress)reason='Already crossed an entrance';else if(state.moves<cost)reason='Not enough moves';return{destination,cost,kind,label,entranceId,available:!reason,reason};}
  _roll(){
    const state=this.state();requirePhase(state,'turn-start');const result=this.random.rollDie(6);const rollIri=NS+`roll-${state.turn}`;const resultIri=rollIri+'-result';
    set(this.store,SESSION,P.die,lit(result,XSD+'integer'));set(this.store,SESSION,P.moves,lit(result,XSD+'integer'));set(this.store,SESSION,P.crossed,lit(false,XSD+'boolean'));set(this.store,SESSION,P.visited,lit(JSON.stringify([state.locations[state.players[state.currentPlayerIndex].tokenId]].filter(id=>!isRoom(id)))));set(this.store,SESSION,P.phase,lit('movement'));set(this.store,SESSION,P.hasRoll,nn(rollIri));
    this.store.addQuads([q(rollIri,P.type,DICE+'DiceRollingAct'),q(rollIri,P.performedBy,nn(state.currentPlayerIri)),q(rollIri,P.hasResult,nn(resultIri)),q(resultIri,P.type,DICE+'DieFaceValue'),q(resultIri,P.value,lit(result,XSD+'integer'))]);return result;
  }
  _moveStep({destination}){
    const state=this.state();requirePhase(state,'movement');const option=this.movementOptions().find(candidate=>candidate.destination===destination);if(!option)throw new Error('That destination is not adjacent.');if(!option.available)throw new Error(option.reason+'.');const player=state.players[state.currentPlayerIndex];const person=NS+'person-'+player.tokenId;set(this.store,person,P.location,nn(locationIri(destination)));set(this.store,SESSION,P.moves,lit(state.moves-option.cost,XSD+'integer'));if(option.kind!=='step')set(this.store,SESSION,P.crossed,lit(true,XSD+'boolean'));const visited=[...state.visited,destination];set(this.store,SESSION,P.visited,lit(JSON.stringify(visited)));this.#recordMove(state,person,state.locations[player.tokenId],destination,option.cost);if(isRoom(destination)||state.moves-option.cost===0)set(this.store,SESSION,P.phase,lit('room-decision'));return option;
  }
  _move(params){return this._moveStep({destination:params.destination??params.siteId??params.roomId})}
  #recordMove(state,person,origin,destination,cost){const count=Number(val(this.store,SESSION,P.moveCount,0))+1;set(this.store,SESSION,P.moveCount,lit(count,XSD+'integer'));const moveIri=NS+`move-${state.turn}-${count}`;this.store.addQuads([q(moveIri,P.type,NS+'MovementAct'),q(moveIri,P.actor,nn(state.currentPlayerIri)),q(moveIri,NS+'movesPerson',nn(person)),q(moveIri,P.origin,nn(locationIri(origin))),q(moveIri,P.destination,nn(locationIri(destination))),q(moveIri,P.paceCost,lit(cost,XSD+'integer'))]);}
  _stopMovement(){const state=this.state();requirePhase(state,'movement');set(this.store,SESSION,P.phase,lit('room-decision'));return state.locations[state.players[state.currentPlayerIndex].tokenId];}
  _secretPassage(){const state=this.state();if(!['turn-start','movement'].includes(state.phase))throw new Error('A secret passage is not available now.');const player=state.players[state.currentPlayerIndex];const from=state.locations[player.tokenId],to=SECRET_PASSAGES[from];if(!to)throw new Error('There is no secret passage from this room.');const person=NS+'person-'+player.tokenId;set(this.store,person,P.location,nn(NS+'room-'+to));const actIri=NS+`secret-passage-${state.turn}`;this.store.addQuads([q(actIri,P.type,NS+'SecretPassageTraversalAct'),q(actIri,P.actor,nn(state.currentPlayerIri)),q(actIri,NS+'movesPerson',nn(person)),q(actIri,P.origin,nn(NS+'room-'+from)),q(actIri,P.destination,nn(NS+'room-'+to))]);set(this.store,SESSION,P.moves,lit(0,XSD+'integer'));set(this.store,SESSION,P.phase,lit('room-decision'));return to;}
  _roomAccuse({suspectId,weaponId}){
    const state=this.state();if(!['turn-start','room-decision'].includes(state.phase))throw new Error('A room accusation is not available now.');const player=state.players[state.currentPlayerIndex],roomId=state.locations[player.tokenId];if(!isRoom(roomId))throw new Error('Room accusations require your suspect person to be in a murder room.');if(!SUSPECTS.some(item=>item.id===suspectId)||!WEAPONS.some(item=>item.id===weaponId))throw new Error('Choose one suspect and one weapon.');set(this.store,NS+'person-'+suspectId,P.location,nn(NS+'room-'+roomId));set(this.store,NS+'weapon-'+weaponId,P.location,nn(NS+'room-'+roomId));set(this.store,SESSION,P.roomAccusation,lit(JSON.stringify({suspectId,weaponId,roomId})));set(this.store,SESSION,P.phase,lit('refutation'));return this.refutation();
  }
  _suggest(params){return this._roomAccuse(params)}
  refutation(){const state=this.state();if(!state.roomAccusation)return null;const ids=Object.values(state.roomAccusation);for(let offset=1;offset<state.players.length;offset+=1){const player=state.players[(state.currentPlayerIndex+offset)%state.players.length];const matches=player.hand.filter(card=>ids.includes(card.id));if(matches.length)return{player,matches};}return null;}
  _resolveRefutation({refuterIri='',cardId=''}){const state=this.state();requirePhase(state,'refutation');const expected=this.refutation();if(expected){if(refuterIri!==expected.player.iri||(cardId&&!expected.matches.some(card=>card.id===cardId)))throw new Error('The selected card is not a legal refutation.');set(this.store,SESSION,P.refuter,nn(refuterIri));}else if(refuterIri)throw new Error('No player can refute this room accusation.');const result=expected;this.#advanceTurn(state);return result;}
  _accuse({suspectId,weaponId,roomId}){const state=this.state();if(!['turn-start','movement','room-decision'].includes(state.phase))throw new Error('A final accusation is not available now.');const player=state.players[state.currentPlayerIndex];if(!FOYER_SITES.includes(state.locations[player.tokenId]))throw new Error('Return your suspect person to a Foyer square before making a final accusation.');if(!SUSPECTS.some(item=>item.id===suspectId)||!WEAPONS.some(item=>item.id===weaponId)||!ROOMS.some(item=>item.id===roomId))throw new Error('Choose one suspect, one weapon, and one room.');const guess=[suspectId,weaponId,roomId];const correct=guess.every(id=>this.solution.includes(id));if(correct){set(this.store,SESSION,P.complete,lit(true,XSD+'boolean'));set(this.store,SESSION,P.phase,lit('complete'));set(this.store,SESSION,P.winner,nn(state.currentPlayerIri));}else{set(this.store,state.currentPlayerIri,P.eliminated,lit(true,XSD+'boolean'));this.#advanceTurn(state);}return correct;}
  _endTurn(){const state=this.state();if(!['turn-start','movement','room-decision','refutation','notebook'].includes(state.phase))throw new Error('Finish the current required action before ending the turn.');return this.#advanceTurn(state);}
  #advanceTurn(state){let next=state.currentPlayerIndex;for(let index=0;index<state.players.length;index+=1){next=(next+1)%state.players.length;if(!state.players[next].eliminated)break;}if(state.players.every(player=>player.eliminated)){set(this.store,SESSION,P.complete,lit(true,XSD+'boolean'));set(this.store,SESSION,P.phase,lit('complete'));return null;}set(this.store,SESSION,P.current,nn(state.players[next].iri));set(this.store,SESSION,P.turn,lit(state.turn+1,XSD+'integer'));for(const predicate of[P.die,P.moves,P.crossed,P.visited,P.roomAccusation,P.refuter,P.moveCount])remove(this.store,SESSION,predicate);set(this.store,SESSION,P.phase,lit('turn-start'));return state.players[next];}
  async verifySolution(){return verifyCommitment(this.solution.slice().sort(),this.commitment);}
  snapshot(){return{format:'everything-is-sus-host-save',version:2,quads:this.store.getQuads(),rngState:this.random.getState(),players:this.players,solution:this.solution,commitment:this.commitment,code:this.code};}
  async playerAccessCodes(){const state=this.state();return Promise.all(state.players.map(async(player,index)=>({playerIri:player.iri,name:player.name,suspectId:player.tokenId,turnOrder:index+1,tableCode:this.code,handCode:await createHandCode({cardIds:player.hand.map(card=>card.id),tableCode:this.code,suspectId:player.tokenId})})));}
}

function set(store,subject,predicate,object){remove(store,subject,predicate);store.addQuad(q(subject,predicate,object))}
function remove(store,subject,predicate){store.removeQuads(store.getQuads(nn(subject),nn(predicate),null,null))}
function requirePhase(state,phase){if(state.complete||state.phase!==phase)throw new Error(`This action requires the ${phase} phase.`)}
function title(value){return value[0].toUpperCase()+value.slice(1)}
function parse(value){try{return value?JSON.parse(value):null}catch{return null}}
function locationIri(id){return NS+(isRoom(id)?'room-':'site-')+id}
function locationId(iri){return iri.startsWith(NS+'room-')?iri.slice((NS+'room-').length):iri.startsWith(NS+'site-')?iri.slice((NS+'site-').length):''}
function roomLabel(id){return ROOMS.find(room=>room.id===id)?.label??id}
export const serializeHostGame=game=>JSON.stringify(game.snapshot());
export function restoreEverythingsSusGame(text){const data=typeof text==='string'?JSON.parse(text):text;const game=new EverythingsSusGame({store:new RdfStore(data.quads),random:new RandomEngine(data.rngState),players:data.players,solution:data.solution,commitment:data.commitment,code:data.code});migrateLegacyState(game);return game}
function migrateLegacyState(game){const used=new Set();SUSPECTS.forEach((suspect,index)=>{const person=NS+'person-'+suspect.id;if(!val(game.store,person,P.location)){const legacy=val(game.store,NS+'token-'+suspect.id,NS+'locatedIn');const legacyId=legacy.startsWith(NS+'room-')?legacy.slice((NS+'room-').length):'';const destination=legacyId&&legacyId!=='foyer'?NS+'room-'+legacyId:NS+'site-'+START_SITES.find(site=>!used.has(site));used.add(destination.slice((NS+'site-').length));game.store.addQuads([q(person,P.type,NS+'SuspectPerson'),q(person,P.label,lit(suspect.label)),q(person,P.location,nn(destination)),q(NS+'token-'+suspect.id,P.represents,nn(person))]);}});if(val(game.store,SESSION,P.phase)==='suggestion')set(game.store,SESSION,P.phase,lit('room-decision'));}
