export const MW = 'https://w3id.org/ontologized-entertainment/maritime-warship/';
export const GAME = 'https://w3id.org/ontologized-entertainment/game/';
export const HI = GAME + 'hidden-information/';
export const BFO = 'http://purl.obolibrary.org/obo/';
export const CCO = 'https://www.commoncoreontologies.org/';
export const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
export const XSD = 'http://www.w3.org/2001/XMLSchema#';
export const V = Object.freeze({
  type: RDF + 'type', value: RDF + 'value', label: 'http://www.w3.org/2000/01/rdf-schema#label',
  member: BFO + 'BFO_0000129', partOf: BFO + 'BFO_0000176', participant: BFO + 'BFO_0000057',
  occursIn: BFO + 'BFO_0000066', occurrentPartOf: BFO + 'BFO_0000132', bearer: BFO + 'BFO_0000196',
  agent: CCO + 'ont00001833', about: CCO + 'ont00001808', designates: CCO + 'ont00001916',
  region: CCO + 'ont00000472', shot: CCO + 'ont00000612', damage: CCO + 'ont00001289', torpedo: CCO + 'ont00000280',
  player: MW + 'hasPlayer', current: MW + 'hasCurrentPlayer', phase: GAME + 'hasCurrentPhase', winner: MW + 'winner',
  configuration: MW + 'hasConfiguration', parameter: MW + 'hasParameter', controller: MW + 'controlledBy', area: MW + 'hasBattleArea',
  coordinate: MW + 'hasCoordinate', boundary: MW + 'hasMaterialBoundary', location: GAME + 'locatedIn', adjacent: GAME + 'adjacentTo',
  missionStasis: MW + 'hasCurrentMissionStasis', damageStasis: MW + 'hasCurrentDamageStasis', forMission: MW + 'forMission',
  struckShip: MW + 'hasStruckShip', struckSegment: MW + 'hasStruckSegment', munition: MW + 'hasMunition',
  targets: MW + 'targetsCell', resolves: MW + 'resolvesAs', causedBy: MW + 'causedByShot', observation: MW + 'hasObservation', grid: MW + 'hasGrid',
  localPlayer: MW + 'hasLocalPlayer', openOrder: MW + 'hasOpenAttackOrder',
  governs: HI + 'governs', visibleTo: HI + 'visibleTo', visibilityMode: HI + 'visibilityMode', visiblePhase: HI + 'visibleDuringPhase'
});
export const SESSION = MW + 'instance/session';
export const instance = local => MW + 'instance/' + local;
export const playerIri = index => instance(`player-${index + 1}`);
export const phaseIri = phase => instance(`phase-${phase}`);
