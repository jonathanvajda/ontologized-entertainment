/** Serialize operations without losing events that arrive during asynchronous work. */
export function createTaskQueue() {
  let pending = Promise.resolve();
  return operation => {
    const next = pending.then(operation);
    pending = next.catch(() => {});
    return next;
  };
}
