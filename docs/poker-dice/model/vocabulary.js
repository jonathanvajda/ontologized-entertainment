export const NS = 'https://w3id.org/ontoeagle/games/poker-dice/';
export const GAME = 'https://w3id.org/ontoeagle/game/';
export const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
export const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
export const XSD = 'http://www.w3.org/2001/XMLSchema#';

export const V = Object.freeze({
  type: RDF + 'type', value: RDF + 'value', label: RDFS + 'label',
  GameSession: GAME + 'GameSession', Player: NS + 'PokerDicePlayer', PokerDie: NS + 'PokerDie', DicePool: NS + 'DicePool',
  Scorecard: NS + 'Scorecard', ScoreEntry: NS + 'ScoreEntry', DieFaceValue: NS + 'DieFaceValue', DiceRollingAct: NS + 'DiceRollingAct',
  hasPlayer: NS + 'hasPlayer', playerOrder: NS + 'playerOrder', currentPlayer: NS + 'hasCurrentPlayer',
  phase: NS + 'hasPhaseIdentifier', round: NS + 'hasRoundNumber', turn: NS + 'hasTurnNumber', rollCount: NS + 'hasRollCount',
  memberOf: GAME + 'memberOf', hasCurrentFace: NS + 'hasCurrentFace', heldBy: NS + 'isHeldBy',
  hasScorecard: NS + 'hasScorecard', hasScoreEntry: NS + 'hasScoreEntry', forCategory: NS + 'forScoringCategory',
  hasResult: NS + 'hasResult', performedBy: NS + 'performedBy', mode: NS + 'hasGameMode', complete: NS + 'isComplete'
});

export const iri = (local) => NS + local;
