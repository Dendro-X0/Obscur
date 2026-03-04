type LogLevel = "debug" | "info" | "warn" | "error";

type LogWindowState = {
  windowStartedAt: number;
  emittedCount: number;
  suppressedCount: number;
};

type RateLimitOptions = Readonly<{
  windowMs?: number;
  maxPerWindow?: number;
  summaryEverySuppressed?: number;
}>;

const GLOBAL_REGISTRY_KEY = "__obscur_log_hygiene_registry__";

const getRegistry = (): Map<string, LogWindowState> => {
  const root = globalThis as Record<string, unknown>;
  const existing = root[GLOBAL_REGISTRY_KEY];
  if (existing instanceof Map) {
    return existing as Map<string, LogWindowState>;
  }
  const created = new Map<string, LogWindowState>();
  root[GLOBAL_REGISTRY_KEY] = created;
  return created;
};

const emit = (level: LogLevel, ...args: ReadonlyArray<unknown>): void => {
  if (level === "error") {
    console.error(...args);
    return;
  }
  if (level === "warn") {
    console.warn(...args);
    return;
  }
  if (level === "info") {
    console.info(...args);
    return;
  }
  console.debug(...args);
};

export const logWithRateLimit = (
  level: LogLevel,
  key: string,
  args: ReadonlyArray<unknown>,
  options?: RateLimitOptions
): void => {
  const windowMs = options?.windowMs ?? 10_000;
  const maxPerWindow = options?.maxPerWindow ?? 3;
  const summaryEverySuppressed = options?.summaryEverySuppressed ?? 50;
  const now = Date.now();
  const registry = getRegistry();
  const current = registry.get(key);

  let state: LogWindowState;
  if (!current || now - current.windowStartedAt > windowMs) {
    state = {
      windowStartedAt: now,
      emittedCount: 0,
      suppressedCount: 0
    };
  } else {
    state = current;
  }

  if (state.emittedCount < maxPerWindow) {
    const suppressedBeforeEmit = state.suppressedCount;
    state.emittedCount += 1;
    state.suppressedCount = 0;
    registry.set(key, state);
    emit(level, ...args);
    if (suppressedBeforeEmit > 0) {
      emit(level, `[LogHygiene] Suppressed ${suppressedBeforeEmit} similar "${key}" messages in the previous window.`);
    }
    return;
  }

  state.suppressedCount += 1;
  registry.set(key, state);

  if (state.suppressedCount === 1 || state.suppressedCount % summaryEverySuppressed === 0) {
    emit(level, `[LogHygiene] Suppressing repeated "${key}" logs (${state.suppressedCount} suppressed in current window).`);
  }
};

