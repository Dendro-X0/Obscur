import type { RelayPoolRuntime } from "@/app/features/relays/services/relay-pool-runtime-port";
import type { TransportAdapterMetrics } from "@obscur/transport-engine";
import type { RelayRecoverySnapshot } from "@/app/features/relays/services/relay-recovery-types";
import { workspaceRelayUrlsMatch } from "@/app/features/groups/services/workspace-relay-url";

export type RelayRecoveryAdapterConfig = Readonly<{
  pool: RelayPoolRuntime;
  enabledRelayUrls: ReadonlyArray<string>;
}>;

export const createDefaultRelayRecoverySnapshot = (): RelayRecoverySnapshot => ({
  readiness: "offline",
  writableRelayCount: 0,
  fallbackWritableRelayCount: 0,
  subscribableRelayCount: 0,
  writeBlockedRelayCount: 0,
  coolingDownRelayCount: 0,
  recoveryAttemptCount: 0,
  fallbackRelayUrls: [],
});

const findLastFailureReason = (pool: RelayPoolRuntime): string | undefined => {
  const sorted = [...pool.healthMetrics].sort((a, b) => {
    const aTime = a.lastErrorAt?.getTime() ?? 0;
    const bTime = b.lastErrorAt?.getTime() ?? 0;
    return bTime - aTime;
  });
  return sorted.find((metric) => typeof metric.lastError === "string" && metric.lastError.length > 0)?.lastError;
};

const isEnabledPoolUrl = (
  url: string,
  enabledRelayUrls: ReadonlyArray<string>,
): boolean => (
  enabledRelayUrls.some((enabled) => (
    enabled === url || workspaceRelayUrlsMatch(enabled, url)
  ))
);

/**
 * Open in-pool sockets count as writable/subscribable even when mesh publishReady lags
 * (parity with use-conduit-mesh-relay-pool resolveWritableRelayUrls E3).
 */
export const resolveRecoveryWritableRelayCount = (params: Readonly<{
  writableRelayUrls: ReadonlyArray<string>;
  openPoolRelayUrls: ReadonlyArray<string>;
  activityWritableRelayCount: number;
}>): number => (
  Math.max(
    params.activityWritableRelayCount,
    params.writableRelayUrls.length,
    params.openPoolRelayUrls.length,
  )
);

export const extractRelayRecoveryAdapterMetrics = (
  config: RelayRecoveryAdapterConfig,
): TransportAdapterMetrics => {
  const writableSnapshot = config.pool.getWritableRelaySnapshot(config.enabledRelayUrls);
  const activity = config.pool.getTransportActivitySnapshot();
  const openPoolRelayUrls = (config.pool.connections ?? [])
    .filter((connection) => (
      connection.status === "open"
      && isEnabledPoolUrl(connection.url, config.enabledRelayUrls)
    ))
    .map((connection) => connection.url);
  const writableRelayCount = resolveRecoveryWritableRelayCount({
    writableRelayUrls: writableSnapshot.writableRelayUrls,
    openPoolRelayUrls,
    activityWritableRelayCount: activity.writableRelayCount,
  });
  const subscribableRelayCount = Math.max(
    activity.subscribableRelayCount,
    writableRelayCount,
  );
  return {
    enabledRelayCount: config.enabledRelayUrls.length,
    writableRelayCount,
    fallbackWritableRelayCount: activity.fallbackWritableRelayCount ?? 0,
    subscribableRelayCount,
    writeBlockedRelayCount: activity.writeBlockedRelayCount,
    coolingDownRelayCount: activity.coolingDownRelayCount,
    lastInboundMessageAtUnixMs: activity.lastInboundMessageAtUnixMs,
    lastInboundEventAtUnixMs: activity.lastInboundEventAtUnixMs,
    lastSuccessfulPublishAtUnixMs: activity.lastSuccessfulPublishAtUnixMs,
    fallbackRelayUrls: activity.fallbackRelayUrls,
    lastFailureReason: findLastFailureReason(config.pool),
  };
};
