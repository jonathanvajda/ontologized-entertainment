export const GAME_VERSION = '0.1.0';
export const SCHEMA_VERSION = '1';
export const GAME_ID = 'https://w3id.org/ontoeagle/games/poker-dice';

export const CATEGORIES = Object.freeze([
  { id: 'ones', label: 'Ones', section: 'upper', hint: 'Add all ones' },
  { id: 'twos', label: 'Twos', section: 'upper', hint: 'Add all twos' },
  { id: 'threes', label: 'Threes', section: 'upper', hint: 'Add all threes' },
  { id: 'fours', label: 'Fours', section: 'upper', hint: 'Add all fours' },
  { id: 'fives', label: 'Fives', section: 'upper', hint: 'Add all fives' },
  { id: 'sixes', label: 'Sixes', section: 'upper', hint: 'Add all sixes' },
  { id: 'three-kind', label: 'Three of a Kind', section: 'lower', hint: 'Total all dice' },
  { id: 'four-kind', label: 'Four of a Kind', section: 'lower', hint: 'Total all dice' },
  { id: 'full-house', label: 'Full House', section: 'lower', hint: 'Three plus two · 25' },
  { id: 'small-straight', label: 'Small Straight', section: 'lower', hint: 'Four in sequence · 30' },
  { id: 'large-straight', label: 'Large Straight', section: 'lower', hint: 'Five in sequence · 40' },
  { id: 'five-kind', label: 'Five of a Kind', section: 'lower', hint: 'All match · 50' },
  { id: 'choice', label: 'Choice', section: 'lower', hint: 'Total all dice' }
]);

export const STANDARD_PROFILE = Object.freeze({
  id: 'standard-13', diceCount: 5, sides: 6, maxRolls: 3,
  upperBonusThreshold: 63, upperBonusScore: 35,
  minPlayers: 1, maxPlayers: 6, categories: CATEGORIES
});
