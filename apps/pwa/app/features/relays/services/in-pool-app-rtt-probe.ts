/**
 * In-pool application RTT: REQ → EOSE on existing open sockets (no second WebSocket).
 * @see specs/backend/relay-in-pool-app-rtt-design-2026-07.md
 */

export type InPoolAppRttResult = Readonly<{
  url: string;
  latencyMs: number;
  ok: boolean;
  errorMessage?: string;
}>;

export type InPoolAppRttCycleParams = Readonly<{
  openUrls: ReadonlyArray<string>;
  sendToOpen: (payload: string) => void;
  subscribeToMessages: (
    handler: (params: Readonly<{ url: string; message: string }>) => void,
  ) => () => void;
  timeoutMs?: number;
  now?: () => number;
  createSubscriptionId?: () => string;
  sleep?: (ms: number) => Promise<void>;
}>;

/** Impossible event id — empty match set; relays should EOSE promptly. */
export const IN_POOL_RTT_EMPTY_FILTER = {
  ids: ["0000000000000000000000000000000000000000000000000000000000000001"],
} as const;

export const IN_POOL_RTT_TIMEOUT_MS = 4_000;
export const IN_POOL_RTT_INITIAL_DELAY_MS = 8_000;
export const IN_POOL_RTT_INTERVAL_MS = 30_000;

export const createInPoolRttSubscriptionId = (): string => (
  `obscur-rtt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
);

const defaultSleep = (ms: number): Promise<void> => (
  new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  })
);

const parseEoseSubscriptionId = (message: string): string | null => {
  try {
    const parsed = JSON.parse(message) as unknown;
    if (!Array.isArray(parsed) || parsed[0] !== "EOSE") {
      return null;
    }
    return typeof parsed[1] === "string" ? parsed[1] : null;
  } catch {
    return null;
  }
};

/**
 * Broadcasts one REQ to all open pool sockets; records per-URL RTT from EOSE.
 */
export const runInPoolAppRttCycle = async (
  params: InPoolAppRttCycleParams,
): Promise<ReadonlyArray<InPoolAppRttResult>> => {
  const openUrls = Array.from(new Set(
    params.openUrls.map((url) => url.trim()).filter((url) => url.length > 0),
  ));
  if (openUrls.length === 0) {
    return [];
  }

  const timeoutMs = params.timeoutMs ?? IN_POOL_RTT_TIMEOUT_MS;
  const now = params.now ?? Date.now;
  const sleep = params.sleep ?? defaultSleep;
  const subId = (params.createSubscriptionId ?? createInPoolRttSubscriptionId)();
  const startMs = now();
  const pending = new Set(openUrls);
  const results = new Map<string, InPoolAppRttResult>();

  let settleAll: (() => void) | undefined;
  const allDone = new Promise<void>((resolve) => {
    settleAll = resolve;
  });

  const unsubscribe = params.subscribeToMessages(({ url, message }) => {
    if (!pending.has(url)) {
      return;
    }
    const eoseId = parseEoseSubscriptionId(message);
    if (eoseId !== subId) {
      return;
    }
    pending.delete(url);
    results.set(url, {
      url,
      latencyMs: Math.max(1, now() - startMs),
      ok: true,
    });
    if (pending.size === 0) {
      settleAll?.();
    }
  });

  try {
    params.sendToOpen(JSON.stringify(["REQ", subId, IN_POOL_RTT_EMPTY_FILTER]));
    await Promise.race([
      allDone,
      sleep(timeoutMs),
    ]);
  } finally {
    try {
      params.sendToOpen(JSON.stringify(["CLOSE", subId]));
    } catch {
      // ignore close send failures
    }
    unsubscribe();
  }

  for (const url of openUrls) {
    if (!results.has(url)) {
      results.set(url, {
        url,
        latencyMs: 0,
        ok: false,
        errorMessage: "eose timeout",
      });
    }
  }

  return openUrls.map((url) => results.get(url)!);
};

/** Enabled URLs that are not currently open — keep second-socket handshake probe only for these. */
export const resolveHandshakeProbeUrls = (params: Readonly<{
  enabledUrls: ReadonlyArray<string>;
  openUrls: ReadonlyArray<string>;
}>): ReadonlyArray<string> => {
  const open = new Set(params.openUrls);
  return params.enabledUrls.filter((url) => !open.has(url));
};
