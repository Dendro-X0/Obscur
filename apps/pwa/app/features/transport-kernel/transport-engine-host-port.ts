import { createTauriEngineHost, isTauriEngineHostAvailable } from "@obscur/engine-host/tauri";
import {
  buildTransportPublishRelayEventRequest,
  type EngineInvokeResult,
  type HostEnginePort,
  isTransportPublishRelayEventResult,
  type TransportPublishRelayEventPayload,
  type TransportPublishRelayEventResult,
} from "@obscur/engine-contracts";

let transportEngineHost: HostEnginePort | null = null;

/** Lazy singleton for transport-engine SDK persistence calls (native only). */
export const getTransportEngineHost = (): HostEnginePort | null => {
  if (!isTauriEngineHostAvailable()) {
    return null;
  }
  transportEngineHost ??= createTauriEngineHost();
  return transportEngineHost;
};

export const resetTransportEngineHostForTests = (): void => {
  transportEngineHost = null;
};

export const invokeTransportPublishRelayEvent = async (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  payload: TransportPublishRelayEventPayload;
}>): Promise<EngineInvokeResult> => {
  const host = getTransportEngineHost();
  if (!host) {
    return {
      ok: false,
      errorCode: "transport_engine_host_unavailable",
      errorMessage: "Transport engine host is unavailable.",
    };
  }
  return host.invoke(buildTransportPublishRelayEventRequest(params));
};

export type TransportPublishRelayEventHostResult = Readonly<
  | { ok: true; data: TransportPublishRelayEventResult }
  | {
    ok: false;
    errorCode:
      | "transport_engine_host_unavailable"
      | "transport_publish_not_wired"
      | "transport_publish_invalid_result"
      | "transport_publish_invoke_failed";
    errorMessage: string;
  }
>;

export const publishRelayEventViaTransportEngineHost = async (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  payload: TransportPublishRelayEventPayload;
}>): Promise<TransportPublishRelayEventHostResult> => {
  const result = await invokeTransportPublishRelayEvent(params);
  if (!result.ok) {
    if (result.errorCode === "transport_engine_host_unavailable") {
      return { ok: false, errorCode: "transport_engine_host_unavailable", errorMessage: result.errorMessage ?? "Host unavailable." };
    }
    if (result.errorCode === "transport_publish_not_wired") {
      return { ok: false, errorCode: "transport_publish_not_wired", errorMessage: result.errorMessage ?? "Transport publish is not wired." };
    }
    return {
      ok: false,
      errorCode: "transport_publish_invoke_failed",
      errorMessage: result.errorMessage ?? "Transport publish invoke failed.",
    };
  }

  if (!isTransportPublishRelayEventResult(result.data)) {
    return {
      ok: false,
      errorCode: "transport_publish_invalid_result",
      errorMessage: "Transport publish returned an invalid result shape.",
    };
  }

  return { ok: true, data: result.data };
};
