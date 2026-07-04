import type { EngineInvokeRequest } from "./host-engine-port";

export const TRANSPORT_ENGINE_METHODS = {
  listRelayCheckpoints: "listRelayCheckpoints",
  listConfiguredRelayUrls: "listConfiguredRelayUrls",
  publishRelayEvent: "publishRelayEvent",
} as const;

export type TransportEngineMethod = (typeof TRANSPORT_ENGINE_METHODS)[keyof typeof TRANSPORT_ENGINE_METHODS];

export type TransportListRelayCheckpointsPayload = Readonly<Record<string, never>>;

export type TransportListConfiguredRelayUrlsPayload = Readonly<Record<string, never>>;

export type TransportPublishRelayEventPayload = Readonly<{
  relayUrls: ReadonlyArray<string>;
  payload: string;
  correlationId?: string;
}>;

export type TransportPublishRelayEventRelayResult = Readonly<{
  relayUrl: string;
  success: boolean;
  error?: string;
  latency?: number;
}>;

export type TransportPublishRelayEventResult = Readonly<{
  success: boolean;
  successCount: number;
  totalRelays: number;
  quorumRequired: number;
  metQuorum: boolean;
  results: ReadonlyArray<TransportPublishRelayEventRelayResult>;
  failures: ReadonlyArray<TransportPublishRelayEventRelayResult>;
  overallError?: string;
  correlationId?: string;
}>;

export const isTransportEngineMethod = (method: string): method is TransportEngineMethod => (
  method === TRANSPORT_ENGINE_METHODS.listRelayCheckpoints
  || method === TRANSPORT_ENGINE_METHODS.listConfiguredRelayUrls
  || method === TRANSPORT_ENGINE_METHODS.publishRelayEvent
);

export const isTransportPublishRelayEventResult = (
  value: unknown,
): value is TransportPublishRelayEventResult => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const v = value as Partial<TransportPublishRelayEventResult>;
  return typeof v.success === "boolean"
    && typeof v.successCount === "number"
    && typeof v.totalRelays === "number"
    && typeof v.quorumRequired === "number"
    && typeof v.metQuorum === "boolean"
    && Array.isArray(v.results)
    && Array.isArray(v.failures);
};

export const buildTransportListRelayCheckpointsRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
}>): EngineInvokeRequest => ({
  engine: "transport",
  method: TRANSPORT_ENGINE_METHODS.listRelayCheckpoints,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: {},
});

export const buildTransportListConfiguredRelayUrlsRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
}>): EngineInvokeRequest => ({
  engine: "transport",
  method: TRANSPORT_ENGINE_METHODS.listConfiguredRelayUrls,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: {},
});

export const buildTransportPublishRelayEventRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  payload: TransportPublishRelayEventPayload;
}>): EngineInvokeRequest => ({
  engine: "transport",
  method: TRANSPORT_ENGINE_METHODS.publishRelayEvent,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: params.payload,
});
