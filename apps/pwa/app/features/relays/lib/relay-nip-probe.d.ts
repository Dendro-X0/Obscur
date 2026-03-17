export type RelayNipProbeCheck =
  | "relay_socket"
  | "relay_publish"
  | "relay_subscribe"
  | "nip11_fetch"
  | "nip96_discovery"
  | "nip96_auth_precheck";

export type RelayNipProbeStatus = "ok" | "degraded" | "failed" | "unsupported";

export type RelayNipProbeResult = Readonly<{
  target: string;
  check: RelayNipProbeCheck;
  status: RelayNipProbeStatus;
  reasonCode?: string;
  retryable: boolean;
  latencyMs?: number;
  message?: string;
}>;

export type RelayNipProbeParams = Readonly<{
  relayUrls: ReadonlyArray<string>;
  nip96Urls?: ReadonlyArray<string>;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  webSocketFactory?: (url: string) => WebSocket;
}>;

export declare const runRelayNipProbe: (
  params: RelayNipProbeParams
) => Promise<ReadonlyArray<RelayNipProbeResult>>;

export declare const summarizeRelayNipProbeResults: (
  results: ReadonlyArray<RelayNipProbeResult>
) => Readonly<{
  ok: number;
  degraded: number;
  failed: number;
  unsupported: number;
}>;
