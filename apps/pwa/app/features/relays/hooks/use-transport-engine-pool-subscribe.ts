"use client";

import { useEffect, useMemo } from "react";
import type { EnhancedRelayPoolResult } from "./enhanced-relay-pool-types";
import { logAppEvent } from "@/app/shared/log-app-event";
import {
  resolveTransportEnginePoolSubscribeUrls,
  syncTransportEnginePoolSubscriptions,
} from "../services/transport-relay-pool-subscribe";

type UseTransportEnginePoolSubscribeParams = Readonly<{
  enabled: boolean;
  pool: EnhancedRelayPoolResult;
  permanentPoolUrls: ReadonlyArray<string>;
  engineOnlyRelayUrls: ReadonlyArray<string>;
  engineCheckpointRelayUrls: ReadonlyArray<string>;
}>;

/** Subscribes transient pool connections for transport-engine relay evidence not in the permanent pool. */
export const useTransportEnginePoolSubscribe = (
  params: UseTransportEnginePoolSubscribeParams,
): void => {
  const subscribeUrls = useMemo(
    () => resolveTransportEnginePoolSubscribeUrls({
      permanentPoolUrls: params.permanentPoolUrls,
      engineOnlyRelayUrls: params.engineOnlyRelayUrls,
      engineCheckpointRelayUrls: params.engineCheckpointRelayUrls,
    }),
    [
      params.permanentPoolUrls.join("|"),
      params.engineOnlyRelayUrls.join("|"),
      params.engineCheckpointRelayUrls.join("|"),
    ],
  );
  const subscribeUrlsKey = subscribeUrls.join("|");

  useEffect(() => {
    if (!params.enabled || subscribeUrls.length === 0) {
      return;
    }
    const subscribedCount = syncTransportEnginePoolSubscriptions({
      pool: params.pool,
      subscribeUrls,
    });
    if (subscribedCount === 0) {
      return;
    }
    logAppEvent({
      name: "relay.transport_engine_pool_subscribe",
      level: "info",
      scope: { feature: "relays", action: "transport_engine_pool_subscribe" },
      context: {
        subscribedCount,
        subscribeUrls: subscribeUrls.join(","),
      },
    });
  }, [params.enabled, params.pool, subscribeUrls, subscribeUrlsKey]);
};
