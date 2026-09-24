export const success = (value = {}, extra = {}) => ({ ok: true, ...extra, value });

export const failure = (code, message, details = {}) => ({
  ok: false,
  code,
  message,
  details
});

export function asFailure(error, code = 'ENGINE_ERROR') {
  return failure(code, error instanceof Error ? error.message : String(error), {
    cause: error instanceof Error ? error : undefined
  });
}
