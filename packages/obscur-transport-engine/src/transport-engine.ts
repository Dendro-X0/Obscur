import {
  buildTransportSnapshot,
  createDefaultTransportSnapshot,
} from "./build-transport-snapshot";
import type {
  TransportAdapterMetrics,
  TransportRecoveryState,
  TransportSnapshot,
} from "./transport-types";
import type { EngineScope } from "@obscur/engine-contracts";

export type TransportEngine = Readonly<{
  getSnapshot: () => TransportSnapshot;
  subscribe: (listener: () => void) => () => void;
  applyAdapterMetrics: (
    metrics: TransportAdapterMetrics,
    context?: Readonly<{
      enabledRelayUrls?: ReadonlyArray<string>;
      recoveryState?: Partial<TransportRecoveryState>;
      activeSubscriptionCount?: number;
      pendingOutboundCount?: number;
      browserOffline?: boolean;
    }>,
  ) => TransportSnapshot;
}>;

export const createTransportEngine = (scope: EngineScope): TransportEngine => {
  let snapshot = createDefaultTransportSnapshot(scope);
  let revision = 0;
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    applyAdapterMetrics: (metrics, context) => {
      revision += 1;
      snapshot = buildTransportSnapshot({
        scope,
        revision,
        enabledRelayUrls: context?.enabledRelayUrls ?? snapshot.enabledRelayUrls,
        metrics,
        recoveryState: context?.recoveryState,
        previous: snapshot,
        activeSubscriptionCount: context?.activeSubscriptionCount,
        pendingOutboundCount: context?.pendingOutboundCount,
        browserOffline: context?.browserOffline,
      });
      emit();
      return snapshot;
    },
  };
};
