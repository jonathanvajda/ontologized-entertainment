import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

export async function browserLibrary(path, name) {
  const context = vm.createContext({ console, TextEncoder, TextDecoder, setTimeout, clearTimeout, AbortController, AbortSignal, queueMicrotask });
  context.self = context; context.window = context; context.global = context;
  vm.runInContext(await readFile(path, 'utf8'), context, { filename: String(path) });
  return context[name];
}
export const N3 = await browserLibrary(new URL('../../vendor/n3.min.js', import.meta.url), 'N3');
