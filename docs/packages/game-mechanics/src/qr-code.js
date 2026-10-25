export function createQrSvgMarkup(data, { cellSize = 4, margin = 4, errorCorrection = 'M', factory = globalThis.qrcode } = {}) {
  if (typeof factory !== 'function') throw new Error('The QR generator dependency is unavailable.');
  const qr = factory(0, errorCorrection);
  qr.addData(String(data), 'Byte');
  qr.make();
  return qr.createSvgTag({ cellSize, margin, scalable: true });
}

export function renderQrCode(container, data, options = {}) {
  if (!container?.replaceChildren) throw new TypeError('A QR container element is required.');
  const template = container.ownerDocument.createElement('template');
  template.innerHTML = createQrSvgMarkup(data, options).trim();
  const svg = template.content.firstElementChild;
  if (!svg) throw new Error('The QR generator returned no SVG.');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', options.label || 'QR code');
  container.replaceChildren(svg);
  return svg;
}
