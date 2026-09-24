import { createPokerDiceGame, parseSnapshot, serializeSnapshot } from './model/poker-dice-model.js';
import { renderDice } from './rendering/dice-svg.js';
import { renderScorecard } from './rendering/scorecard.js';
import { downloadSave, loadLocal, saveLocal } from './storage.js';

let game = null; let rolling = false;
const $ = (selector) => document.querySelector(selector);
const setup = $('#setup-dialog'); const gameScreen = $('#game-screen'); const diceTray = $('#dice-tray'); const scorecard = $('#scorecard');
const status = $('#live-status'); const alert = $('#alert-status');

$('#player-count').addEventListener('input', buildNameFields); buildNameFields();
$('#setup-form').addEventListener('submit', (event) => { event.preventDefault(); startNewGame(); });
$('#roll-button').addEventListener('click', rollDice);
$('#new-game-button').addEventListener('click', () => { game = null; gameScreen.hidden = true; setup.showModal(); });
$('#save-button').addEventListener('click', async () => { await persist(); announce('Game saved on this device.'); });
$('#export-button').addEventListener('click', () => game && downloadSave(serializeSnapshot(game)));
$('#import-button').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', importGame);
$('#resume-button').addEventListener('click', resumeGame);
$('#undo-button').addEventListener('click', () => historyStep('undo'));
$('#redo-button').addEventListener('click', () => historyStep('redo'));
$('#continue-button').addEventListener('click', () => { $('#pass-dialog').close(); announce(`${game.state().players[game.state().currentPlayerIndex].name}, roll all five dice.`); });

loadLocal().then((saved) => { $('#resume-button').hidden = !saved; }).catch(() => { $('#resume-button').hidden = true; });
setup.showModal();

function buildNameFields() {
  const count = Number($('#player-count').value); const holder = $('#player-names'); const existing = [...holder.querySelectorAll('input')].map((input) => input.value); holder.replaceChildren();
  for (let i = 0; i < count; i += 1) { const label = document.createElement('label'); label.textContent = count === 1 ? 'Player name' : `Player ${i + 1}`; const input = document.createElement('input'); input.required = true; input.maxLength = 24; input.value = existing[i] || (count === 1 ? 'Player' : `Player ${i + 1}`); label.append(input); holder.append(label); }
}

function startNewGame() {
  const names = [...$('#player-names').querySelectorAll('input')].map((input) => input.value.trim()); const seed = $('#seed').value.trim() || Date.now();
  game = createPokerDiceGame({ names, seed }); setup.close(); gameScreen.hidden = false; render(); persist(); announce(`${names[0]} begins. Roll all five dice.`);
}

async function resumeGame() {
  try { const saved = await loadLocal(); if (!saved) throw new Error('No saved game was found.'); game = parseSnapshot(saved); setup.close(); gameScreen.hidden = false; render(); announce('Saved game restored.'); }
  catch (error) { showError(error.message); }
}

async function rollDice() {
  if (!game || rolling) return; const before = game.state();
  if (before.rollCount > 0 && before.dice.every((die) => die.held) && !confirm('All dice are held. Use a roll without changing them?')) return;
  rolling = true; $('#roll-button').disabled = true;
  const result = await game.act('rollDice');
  if (!result.ok) { rolling = false; showError(result.message); render(); return; }
  render(true); setTimeout(() => { rolling = false; render(); persist(); const state = game.state(); announce(`Roll ${state.rollCount}: ${state.dice.map((die) => die.value).join(', ')}. ${state.phase === 'must-score' ? 'Choose a category.' : 'Hold dice, roll again, or score.'}`); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 360);
}

async function toggleDie(dieIri) { const result = await game.act('toggleHold', { dieIri }); if (!result.ok) return showError(result.message); render(); persist(); }
async function chooseScore(category, preview) {
  if (preview === 0 && !confirm(`Score zero in ${category.label}? This category cannot be used again.`)) return;
  const player = game.state().players[game.state().currentPlayerIndex];
  if (preview > 0 && !confirm(`Record ${preview} points in ${category.label} for ${player.name}?`)) return;
  const result = await game.act('commitScore', { categoryId: category.id }); if (!result.ok) return showError(result.message);
  render(); persist(); const state = game.state();
  if (state.complete) announce(resultText(state));
  else if (state.players.length > 1) { $('#pass-player').textContent = `${state.players[state.currentPlayerIndex].name}, you’re up`; $('#pass-dialog').showModal(); }
  else announce(`${preview} recorded. Roll to begin turn ${Object.keys(state.players[0].scores).length + 1}.`);
}

function render(animate = false) {
  const state = game.state(); const active = state.players[state.currentPlayerIndex];
  $('#current-player').textContent = state.complete ? 'Game complete' : active.name;
  $('#turn-meta').textContent = state.complete ? resultText(state) : `${state.players.length > 1 ? `Round ${state.roundNumber} · ` : ''}Roll ${state.rollCount} of 3`;
  $('#turn-prompt').textContent = state.complete ? 'Final results are shown below.' : state.rollCount === 0 ? 'Roll all five dice.' : state.phase === 'must-score' ? 'No rolls remain—choose a category.' : 'Tap dice to hold them, roll again, or choose a score.';
  renderDice(diceTray, state.dice, { enabled: state.legalActions.includes('toggleHold'), rolling: animate, onToggle: toggleDie });
  renderScorecard(scorecard, state, { onScore: chooseScore });
  const rollButton = $('#roll-button'); rollButton.disabled = rolling || !state.legalActions.includes('rollDice'); rollButton.textContent = state.rollCount === 0 ? 'Roll dice' : `Roll again · ${3 - state.rollCount} left`;
  const historyAllowed = state.mode === 'solitaire'; const cursor = game.engine.transactions.cursor; const entries = game.engine.transactions.entries();
  $('#undo-button').hidden = !historyAllowed; $('#redo-button').hidden = !historyAllowed;
  $('#undo-button').disabled = !historyAllowed || cursor === 0; $('#redo-button').disabled = !historyAllowed || cursor >= entries.length;
  $('#results').hidden = !state.complete; if (state.complete) renderResults(state);
}

function renderResults(state) {
  const list = $('#ranking'); list.replaceChildren();
  if (state.players.length === 1) { const item = document.createElement('li'); item.innerHTML = `<strong>${state.achievement}</strong><span>${state.players[0].totals.grand} points</span>`; list.append(item); }
  else state.ranking.forEach((player) => { const item = document.createElement('li'); item.innerHTML = `<strong>${player.rank}. ${escapeHtml(player.name)}</strong><span>${player.totals.grand} points</span>`; list.append(item); });
}

async function persist() { if (!game) return; try { await saveLocal(serializeSnapshot(game)); } catch { /* Gameplay remains available when storage is blocked. */ } }
function historyStep(direction) {
  if (!game || game.state().mode !== 'solitaire') return;
  const result = game.engine[direction](); if (!result.ok) return showError(result.message);
  render(); persist(); announce(`${direction === 'undo' ? 'Undid' : 'Redid'} the last action.`);
}
async function importGame(event) {
  try { const file = event.target.files[0]; if (!file) return; if (file.size > 5_000_000) throw new Error('That save file is too large.'); game = parseSnapshot(await file.text()); setup.close(); gameScreen.hidden = false; render(); persist(); announce('Imported game restored.'); }
  catch (error) { showError(error.message); } finally { event.target.value = ''; }
}
function resultText(state) { return state.players.length === 1 ? `${state.achievement}: ${state.players[0].totals.grand} points.` : `${state.ranking.filter((p) => p.rank === 1).map((p) => p.name).join(' and ')} ${state.ranking.filter((p) => p.rank === 1).length > 1 ? 'tie' : 'wins'} with ${state.ranking[0].totals.grand} points.`; }
function announce(message) { status.textContent = ''; requestAnimationFrame(() => { status.textContent = message; }); }
function showError(message) { alert.textContent = message; setTimeout(() => { alert.textContent = ''; }, 5000); }
function escapeHtml(value) { const span = document.createElement('span'); span.textContent = value; return span.innerHTML; }

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./service-worker.js').catch(() => {});
