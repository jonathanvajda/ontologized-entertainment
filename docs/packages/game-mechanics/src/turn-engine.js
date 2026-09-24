import { success, failure } from './result.js';

export class TurnEngine {
  constructor({ players = [], phases = ['main'], currentPlayerIndex = 0, phaseIndex = 0, round = 1, turn = 1 } = {}) {
    this.players = [...players]; this.phases = [...phases]; this.currentPlayerIndex = currentPlayerIndex;
    this.phaseIndex = phaseIndex; this.round = round; this.turn = turn;
  }
  currentPlayer() { return this.players[this.currentPlayerIndex] || null; }
  currentPhase() { return this.phases[this.phaseIndex] || null; }
  canAct(actorIri, permittedPhases = this.phases) {
    if (actorIri !== this.currentPlayer()) return failure('NOT_CURRENT_PLAYER', 'The actor is not the current player.');
    if (!permittedPhases.includes(this.currentPhase())) return failure('WRONG_PHASE', 'The action is not permitted in the current phase.');
    return success(this.snapshot());
  }
  nextPhase() {
    this.phaseIndex += 1;
    if (this.phaseIndex >= this.phases.length) return this.endTurn();
    return this.snapshot();
  }
  endTurn() {
    this.phaseIndex = 0; this.turn += 1; this.currentPlayerIndex += 1;
    if (this.currentPlayerIndex >= this.players.length) { this.currentPlayerIndex = 0; this.round += 1; }
    return this.snapshot();
  }
  snapshot() { return { currentPlayerIri: this.currentPlayer(), phase: this.currentPhase(), round: this.round, turn: this.turn }; }
}
