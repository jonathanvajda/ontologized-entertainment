export function createViewModel(projection, { entities = {}, theme = {}, legalActions = [] } = {}) {
  return Object.freeze({
    entities: [...projection.typesByEntity.keys()].map((entityIri) => ({
      iri: entityIri,
      types: projection.typesByEntity.get(entityIri),
      visual: entities[entityIri] || null
    })),
    adjacency: mapEntries(projection.adjacencyByTerritory),
    piecesByLocation: mapEntries(projection.piecesByLocation),
    scores: mapEntries(projection.scoreByPlayer),
    legalActions: [...legalActions],
    theme: { ...theme }
  });
}

export function createSvgRenderer(svg, { onAction = () => {} } = {}) {
  if (!(svg instanceof SVGElement)) throw new TypeError('An SVGElement is required.');
  return {
    render(viewModel) {
      for (const entity of viewModel.entities) {
        if (!entity.visual?.selector) continue;
        const element = svg.querySelector(entity.visual.selector);
        if (!element) continue;
        element.dataset.entityIri = entity.iri;
        element.setAttribute('tabindex', '0');
        element.setAttribute('role', 'button');
        element.setAttribute('aria-label', entity.visual.label || entity.iri);
        if (entity.visual.fill) element.style.fill = entity.visual.fill;
      }
    },
    connect() {
      const activate = (event) => {
        const element = event.target.closest?.('[data-entity-iri]');
        if (element) onAction({ actionType: 'select', targetIri: element.dataset.entityIri, clientContext: { eventType: event.type } });
      };
      svg.addEventListener('click', activate);
      svg.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') activate(event); });
    }
  };
}

function mapEntries(map) { return [...map].map(([key, values]) => [key, Array.isArray(values) ? [...values] : values]); }
