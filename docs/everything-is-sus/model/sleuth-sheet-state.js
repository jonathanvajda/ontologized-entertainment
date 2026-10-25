export function normalizeSleuthMarks(cards, ownCardIds, markedCardIds) {
  const own = new Set(ownCardIds);
  const knownCards = new Set(cards.map((card) => card.id));
  const marked = new Set([...markedCardIds].filter((id) => knownCards.has(id) && !own.has(id)));
  const categories = new Set(cards.map((card) => card.category));

  for (const category of categories) {
    const possible = cards.filter((card) => card.category === category && !own.has(card.id));
    if (possible.length && possible.every((card) => marked.has(card.id))) marked.delete(possible.at(-1).id);
  }

  return marked;
}

export function remainingSleuthCandidates(cards, ownCardIds, markedCardIds, category) {
  const own = new Set(ownCardIds);
  const marked = new Set(markedCardIds);
  return cards.filter((card) => card.category === category && !own.has(card.id) && !marked.has(card.id));
}
