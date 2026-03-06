export type AdapterResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; reason: "unsupported" | "failed"; message?: string }>;

export const okResult = <T>(value: T): AdapterResult<T> => ({ ok: true, value });

export const unsupportedResult = <T>(message?: string): AdapterResult<T> => ({
  ok: false,
  reason: "unsupported",
  message,
});

export const failedResult = <T>(message?: string): AdapterResult<T> => ({
  ok: false,
  reason: "failed",
  message,
});

