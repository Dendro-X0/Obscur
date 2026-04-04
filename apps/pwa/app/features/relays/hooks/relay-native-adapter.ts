import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { listenToNativeEvent } from "@/app/features/runtime/native-event-adapter";

export type RelayStatusPayload = Readonly<{
  url: string;
  status: "connected" | "disconnected" | "error" | "starting";
}>;

export type RelayMessagePayload = Readonly<{
  relay_url: string;
  payload: unknown;
}>;

export type RelayProbeReport = Readonly<{
  url: string;
  scheme: string;
  host: string | null;
  port: number | null;
  tor_enabled: boolean;
  proxy_url: string | null;
  dns_ok: boolean;
  dns_results: ReadonlyArray<string>;
  tcp_ok: boolean;
  ws_ok: boolean;
  error: string | null;
}>;

export type TorStatusSnapshot = Readonly<{
  state: "disconnected" | "starting" | "connected" | "error" | "stopped";
  configured: boolean;
  ready: boolean;
  usingExternalInstance: boolean;
  proxyUrl: string;
}>;

const requireNativeValue = async <T>(
  command: string,
  args?: Record<string, unknown>,
  options?: Readonly<{ timeoutMs?: number }>
): Promise<T> => {
  const result = await invokeNativeCommand<T>(command, args, options);
  if (!result.ok) {
    throw new Error(result.message || `Native relay command ${command} failed`);
  }
  return result.value;
};

const CONNECT_TIMEOUT_MS = 20_000;
const PROBE_TIMEOUT_MS = 10_000;
const SEND_TIMEOUT_MS = 8_000;
const SUBSCRIPTION_TIMEOUT_MS = 8_000;
const DISCONNECT_TIMEOUT_MS = 5_000;

export const relayNativeAdapter = {
  getTorStatus: async (): Promise<TorStatusSnapshot> => {
    try {
      return await requireNativeValue<TorStatusSnapshot>("get_tor_status", undefined, { timeoutMs: 5_000 });
    } catch {
      return {
        state: "disconnected",
        configured: false,
        ready: false,
        usingExternalInstance: false,
        proxyUrl: "",
      };
    }
  },
  connectRelay: async (url: string): Promise<string> =>
    requireNativeValue<string>("connect_relay", { url }, { timeoutMs: CONNECT_TIMEOUT_MS }),
  probeRelay: async (url: string): Promise<RelayProbeReport> =>
    requireNativeValue<RelayProbeReport>("probe_relay", { url }, { timeoutMs: PROBE_TIMEOUT_MS }),
  subscribeRelay: async (url: string, subId: string, filter: unknown): Promise<void> => {
    await requireNativeValue("subscribe_relay", { url, sub_id: subId, filter }, { timeoutMs: SUBSCRIPTION_TIMEOUT_MS });
  },
  unsubscribeRelay: async (url: string, subId: string): Promise<void> => {
    await requireNativeValue("unsubscribe_relay", { url, sub_id: subId }, { timeoutMs: SUBSCRIPTION_TIMEOUT_MS });
  },
  sendRelayMessage: async (url: string, message: string): Promise<void> => {
    await requireNativeValue("send_relay_message", { url, message }, { timeoutMs: SEND_TIMEOUT_MS });
  },
  disconnectRelay: async (url: string): Promise<void> => {
    await requireNativeValue("disconnect_relay", { url }, { timeoutMs: DISCONNECT_TIMEOUT_MS });
  },
  recycleRelays: async (): Promise<void> => {
    await requireNativeValue("recycle_relays", undefined, { timeoutMs: 8_000 });
  },
  listenRelayStatus: async (
    handler: (event: { payload?: RelayStatusPayload }) => void
  ): Promise<() => void> => listenToNativeEvent<RelayStatusPayload>("relay-status", handler),
  listenRelayEvent: async (
    handler: (event: { payload?: RelayMessagePayload }) => void
  ): Promise<() => void> => listenToNativeEvent<RelayMessagePayload>("relay-event", handler),
};
