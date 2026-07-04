import type { RelayPoolRuntime } from "@/app/features/relays/services/relay-pool-runtime-port";
import type { TransportAdapterMetrics } from "@obscur/transport-engine";
import type { RelayRecoverySnapshot } from "@/app/features/relays/services/relay-recovery-types";

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

export const extractRelayRecoveryAdapterMetrics = (
  config: RelayRecoveryAdapterConfig,
): TransportAdapterMetrics => {
  const writableSnapshot = config.pool.getWritableRelaySnapshot(config.enabledRelayUrls);
  const activity = config.pool.getTransportActivitySnapshot();
  return {
    enabledRelayCount: config.enabledRelayUrls.length,
    writableRelayCount: writableSnapshot.writableRelayUrls.length,
    fallbackWritableRelayCount: activity.fallbackWritableRelayCount ?? 0,
    subscribableRelayCount: activity.subscribableRelayCount,
    writeBlockedRelayCount: activity.writeBlockedRelayCount,
    coolingDownRelayCount: activity.coolingDownRelayCount,
    lastInboundMessageAtUnixMs: activity.lastInboundMessageAtUnixMs,
    lastInboundEventAtUnixMs: activity.lastInboundEventAtUnixMs,
    lastSuccessfulPublishAtUnixMs: activity.lastSuccessfulPublishAtUnixMs,
    fallbackRelayUrls: activity.fallbackRelayUrls,
    lastFailureReason: findLastFailureReason(config.pool),
  };
};
