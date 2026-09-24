export function createLogger({ level = 'warn', sink = console } = {}) {
  const levels = ['debug', 'info', 'warn', 'error']; const threshold = levels.indexOf(level);
  return Object.fromEntries(levels.map((name, index) => [name, (event, details = {}) => {
    if (index >= threshold) sink[name]?.({ timestamp: new Date().toISOString(), level: name, event, ...details });
  }]));
}
