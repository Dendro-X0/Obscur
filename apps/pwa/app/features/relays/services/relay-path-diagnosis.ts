/**
 * Relay network diagnostics Slice A — pure path classifier (no VPN APIs, no probes).
 * Spec: specs/backend/relay-network-diagnostics-design-2026-10.md
 */

export type RelayPathReasonCode =
  | "disabled"
  | "invalid_scheme"
  | "loopback_unreachable"
  | "remote_unreachable"
  | "tls_or_proxy"
  | "open"
  | "connecting"
  | "circuit_open";

export type RelayUrlSchemeKind = "ws" | "wss" | "invalid_scheme";

export type RelayPathDiagnosis = Readonly<{
  url: string;
  reason: RelayPathReasonCode;
  isLoopback: boolean;
  schemeKind: RelayUrlSchemeKind;
}>;

export type RelayPathDiagnosisInput = Readonly<{
  url: string;
  enabled: boolean;
  connectionStatus?: "open" | "connecting" | "error" | "closed" | string | null;
  circuitOpen?: boolean;
  /** Optional last error class from health monitor (e.g. tls_error, proxy_error). */
  lastErrorClass?: string | null;
}>;

export type RelayPoolDiagnosisSummary = Readonly<{
  disabledCount: number;
  invalidSchemeCount: number;
  enabledRemoteDisconnectedCount: number;
  enabledLoopbackDisconnectedCount: number;
  openCount: number;
  connectingCount: number;
  loopbackDisabledCount: number;
  hypothesisCopy: string | null;
  bannerSupplement: string | null;
}>;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export const isRelayLoopbackUrl = (rawUrl: string): boolean => {
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase();
    return LOOPBACK_HOSTS.has(host) || host.endsWith(".localhost");
  } catch {
    const lowered = rawUrl.trim().toLowerCase();
    return lowered.includes("://localhost") || lowered.includes("://127.0.0.1");
  }
};

export const classifyRelayUrlSchemeKind = (rawUrl: string): RelayUrlSchemeKind => {
  const trimmed = rawUrl.trim().toLowerCase();
  if (trimmed.startsWith("wss://")) {
    return "wss";
  }
  if (trimmed.startsWith("ws://")) {
    return "ws";
  }
  return "invalid_scheme";
};

const looksLikeTlsOrProxyError = (lastErrorClass: string | null | undefined): boolean => {
  const value = (lastErrorClass ?? "").trim().toLowerCase();
  if (!value) {
    return false;
  }
  return (
    value.includes("tls")
    || value.includes("proxy")
    || value.includes("certificate")
    || value.includes("ssl")
  );
};

export const classifyRelayPathDiagnosis = (
  input: RelayPathDiagnosisInput,
): RelayPathDiagnosis => {
  const url = input.url.trim();
  const schemeKind = classifyRelayUrlSchemeKind(url);
  const isLoopback = isRelayLoopbackUrl(url);

  if (!input.enabled) {
    return { url, reason: "disabled", isLoopback, schemeKind };
  }
  if (schemeKind === "invalid_scheme") {
    return { url, reason: "invalid_scheme", isLoopback, schemeKind };
  }
  if (input.circuitOpen) {
    return { url, reason: "circuit_open", isLoopback, schemeKind };
  }
  const status = (input.connectionStatus ?? "").trim().toLowerCase();
  if (status === "open") {
    return { url, reason: "open", isLoopback, schemeKind };
  }
  if (status === "connecting") {
    return { url, reason: "connecting", isLoopback, schemeKind };
  }
  if (looksLikeTlsOrProxyError(input.lastErrorClass)) {
    return { url, reason: "tls_or_proxy", isLoopback, schemeKind };
  }
  return {
    url,
    reason: isLoopback ? "loopback_unreachable" : "remote_unreachable",
    isLoopback,
    schemeKind,
  };
};

export const summarizeRelayPoolDiagnosis = (
  diagnoses: ReadonlyArray<RelayPathDiagnosis>,
): RelayPoolDiagnosisSummary => {
  let disabledCount = 0;
  let invalidSchemeCount = 0;
  let enabledRemoteDisconnectedCount = 0;
  let enabledLoopbackDisconnectedCount = 0;
  let openCount = 0;
  let connectingCount = 0;
  let loopbackDisabledCount = 0;

  diagnoses.forEach((row) => {
    switch (row.reason) {
      case "disabled":
        disabledCount += 1;
        if (row.isLoopback) {
          loopbackDisabledCount += 1;
        }
        break;
      case "invalid_scheme":
        invalidSchemeCount += 1;
        break;
      case "open":
        openCount += 1;
        break;
      case "connecting":
        connectingCount += 1;
        break;
      case "loopback_unreachable":
      case "circuit_open":
        enabledLoopbackDisconnectedCount += 1;
        break;
      case "remote_unreachable":
      case "tls_or_proxy":
        enabledRemoteDisconnectedCount += 1;
        break;
      default:
        break;
    }
  });

  const enabledRemotesFail = enabledRemoteDisconnectedCount > 0
    && openCount === 0
    && connectingCount === 0;
  const allEnabledRemotesFail = enabledRemotesFail
    && diagnoses.some((row) => !row.isLoopback && row.reason !== "disabled" && row.reason !== "invalid_scheme");

  let hypothesisCopy: string | null = null;
  if (allEnabledRemotesFail && loopbackDisabledCount > 0) {
    hypothesisCopy = "Public path unhealthy; local relay not tried — enable ws://localhost:7000 for private-trust.";
  } else if (allEnabledRemotesFail && enabledLoopbackDisconnectedCount === 0 && diagnoses.some((d) => d.isLoopback && d.reason === "open")) {
    hypothesisCopy = "Public path may be blocked (VPN/proxy/ISP); local cell is open — continue private-trust on local.";
  } else if (enabledLoopbackDisconnectedCount > 0 && openCount === 0) {
    hypothesisCopy = "Local relay enabled but unreachable — check Docker/process on :7000 (not necessarily VPN).";
  }

  const parts: string[] = [];
  if (disabledCount > 0) {
    parts.push(`${disabledCount} disabled${loopbackDisabledCount > 0 ? ` (incl. local)` : ""}`);
  }
  if (invalidSchemeCount > 0) {
    parts.push(`${invalidSchemeCount} invalid URL scheme`);
  }
  if (enabledRemoteDisconnectedCount > 0) {
    parts.push(`${enabledRemoteDisconnectedCount} enabled remotes with no open socket`);
  }
  if (enabledLoopbackDisconnectedCount > 0) {
    parts.push(`${enabledLoopbackDisconnectedCount} local enabled but not open`);
  }

  const bannerSupplement = parts.length > 0
    ? `${parts.join(" · ")}${hypothesisCopy ? ` · Suggested: ${hypothesisCopy}` : ""}`
    : hypothesisCopy;

  return {
    disabledCount,
    invalidSchemeCount,
    enabledRemoteDisconnectedCount,
    enabledLoopbackDisconnectedCount,
    openCount,
    connectingCount,
    loopbackDisabledCount,
    hypothesisCopy,
    bannerSupplement,
  };
};

export const relayPathReasonDetailCopy = (reason: RelayPathReasonCode): string => {
  switch (reason) {
    case "disabled":
      return "This relay is configured for the profile but currently disabled.";
    case "invalid_scheme":
      return "Not a Nostr WebSocket URL — use ws:// or wss:// (HTTP coordination URLs are not relays).";
    case "loopback_unreachable":
      return "Local relay enabled but no open socket — check the process on this port.";
    case "remote_unreachable":
      return "Enabled remote relay with no open socket — network, proxy, or VPN candidate.";
    case "tls_or_proxy":
      return "TLS or proxy error while connecting — check certificate/proxy path (not proven VPN).";
    case "open":
      return "Relay socket is open.";
    case "connecting":
      return "The runtime is actively establishing this relay connection.";
    case "circuit_open":
      return "Repeated failures triggered relay backoff.";
    default:
      return "Relay path status unknown.";
  }
};

export type RelayPathDiagnosisConfigRow = Readonly<{
  url: string;
  enabled: boolean;
  connectionStatus?: string | null;
  circuitOpen?: boolean;
  lastErrorClass?: string | null;
}>;

/** Build pool summary from configured relay rows (Settings list + pool sockets). */
export const buildRelayPoolDiagnosisSummary = (
  rows: ReadonlyArray<RelayPathDiagnosisConfigRow>,
): RelayPoolDiagnosisSummary => (
  summarizeRelayPoolDiagnosis(rows.map((row) => classifyRelayPathDiagnosis(row)))
);
