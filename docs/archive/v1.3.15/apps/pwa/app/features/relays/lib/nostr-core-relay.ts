import type {
  CoreResult,
  PublishOutcome,
  RelaySnapshot,
  RelayCircuitState,
} from "@dweb/core/security-foundation-contracts";

type RelayConnectionLike = Readonly<{
  url: string;
  status: string;
}>;

type MultiRelayPublishResultLike = Readonly<{
  success: boolean;
  successCount: number;
  totalRelays: number;
  metQuorum?: boolean;
  quorumRequired?: number;
  results: ReadonlyArray<Readonly<{
    relayUrl: string;
    success: boolean;
    error?: string;
  }>>;
  failures?: ReadonlyArray<Readonly<{
    relayUrl: string;
    success: boolean;
    error?: string;
  }>>;
  overallError?: string;
}>;

export type RelayPoolLike = Readonly<{
  connections: ReadonlyArray<RelayConnectionLike>;
  waitForConnection: (timeoutMs: number) => Promise<boolean>;
  publishToUrls?: (urls: ReadonlyArray<string>, payload: string) => Promise<MultiRelayPublishResultLike>;
  publishToAll?: (payload: string) => Promise<MultiRelayPublishResultLike>;
  getRelayCircuitState?: (url: string) => RelayCircuitState;
}>;

const dedupe = (values: ReadonlyArray<string>): ReadonlyArray<string> => Array.from(new Set(values));

const isRetryableRelayErrorMessage = (message: string | undefined): boolean => {
  if (!message) return false;
  return /timeout waiting for ok response/i.test(message)
    || /relay not connected/i.test(message)
    || /no relays are currently connected/i.test(message)
    || /websocket.*closed/i.test(message)
    || /network error/i.test(message)
    || /http error:\s*52\d\b/i.test(message)
    || /service unavailable/i.test(message)
    || /relay status error/i.test(message);
};

export const getRelaySnapshot = (
  pool: RelayPoolLike,
  scopedRelayUrls?: ReadonlyArray<string>
): RelaySnapshot => {
  const configuredRelayUrls = dedupe((scopedRelayUrls ?? pool.connections.map((connection) => connection.url))
    .map((url) => url.trim())
    .filter((url) => url.length > 0));
  const openConnections = pool.connections.filter((connection) => connection.status === "open");
  const writableRelayUrls = dedupe(openConnections
    .map((connection) => connection.url)
    .filter((url) => configuredRelayUrls.length === 0 || configuredRelayUrls.includes(url)));
  const relayCircuitStates = pool.getRelayCircuitState
    ? Object.fromEntries(configuredRelayUrls.map((url) => [url, pool.getRelayCircuitState?.(url) ?? "degraded"]))
    : undefined;
  return {
    atUnixMs: Date.now(),
    configuredRelayUrls,
    writableRelayUrls,
    totalRelayCount: configuredRelayUrls.length,
    openRelayCount: writableRelayUrls.length,
    relayCircuitStates,
  };
};

const toOutcome = (result: MultiRelayPublishResultLike): PublishOutcome => {
  const quorumRequired = result.quorumRequired ?? Math.max(1, Math.ceil(result.totalRelays / 2));
  const failures = (result.failures ?? result.results.filter((entry) => !entry.success)).map((failure) => ({
    relayUrl: failure.relayUrl,
    error: failure.error,
  }));
  return {
    successCount: result.successCount,
    totalRelays: result.totalRelays,
    quorumRequired,
    metQuorum: result.metQuorum ?? result.successCount >= quorumRequired,
    failures,
  };
};

export const publishViaRelayCore = async (params: Readonly<{
  pool: RelayPoolLike;
  payload: string;
  scopedRelayUrls?: ReadonlyArray<string>;
  waitForConnectionMs?: number;
}>): Promise<CoreResult<PublishOutcome>> => {
  const waitForConnectionMs = params.waitForConnectionMs ?? 1_200;
  let snapshot = getRelaySnapshot(params.pool, params.scopedRelayUrls);
  if (snapshot.writableRelayUrls.length === 0) {
    await params.pool.waitForConnection(waitForConnectionMs);
    snapshot = getRelaySnapshot(params.pool, params.scopedRelayUrls);
  }
  if (snapshot.writableRelayUrls.length === 0) {
    return {
      status: "queued",
      reasonCode: "no_writable_relays",
      message: "No writable relays available.",
    };
  }

  const publishResult = params.pool.publishToUrls
    ? await params.pool.publishToUrls(snapshot.writableRelayUrls, params.payload)
    : (params.pool.publishToAll
      ? await params.pool.publishToAll(params.payload)
      : null);

  if (!publishResult) {
    return {
      status: "unsupported",
      reasonCode: "unsupported_runtime",
      message: "Relay pool does not support deterministic publish APIs.",
    };
  }

  const outcome = toOutcome(publishResult);
  if (outcome.metQuorum) {
    return {
      status: outcome.failures.length > 0 ? "partial" : "ok",
      value: outcome,
      reasonCode: outcome.failures.length > 0 ? "relay_degraded" : undefined,
      message: outcome.failures.length > 0
        ? `Delivered with degraded relay coverage (${outcome.successCount}/${outcome.totalRelays}).`
        : "Delivered to quorum relays.",
    };
  }

  if (outcome.successCount > 0) {
    return {
      status: "partial",
      value: outcome,
      reasonCode: "quorum_not_met",
      message: `Partially delivered (${outcome.successCount}/${outcome.totalRelays}).`,
    };
  }

  const overallError = publishResult.overallError ?? "Failed to publish to writable relays.";
  if (isRetryableRelayErrorMessage(overallError) || outcome.failures.some((failure) => isRetryableRelayErrorMessage(failure.error))) {
    return {
      status: "queued",
      value: outcome,
      reasonCode: "relay_degraded",
      message: overallError,
    };
  }

  return {
    status: "failed",
    value: outcome,
    reasonCode: "quorum_not_met",
    message: overallError,
  };
};

export const nostrCoreRelayInternals = {
  toOutcome,
  isRetryableRelayErrorMessage,
};
