/**
 * Wire dialect — how a conduit speaks on the network.
 * Nostr is optional (`nostr_ws`); users may run only `team_relay` or `custom`.
 */
export type ConduitDialect =
  | "team_relay"
  | "coordination_http"
  | "coordination_sse"
  | "nostr_ws"
  | "custom"
  | "lan_mdns"
  | "store_forward";

export type ConduitNetworkPolicy =
  | "clearnet"
  | "tor_preferred"
  | "tor_required";

export type ConduitTrustTier =
  | "operator_attested"
  | "user_configured"
  | "public_untrusted";

export type ConduitCapability =
  | "publish"
  | "subscribe"
  | "pull"
  | "push"
  | "store_forward";

export type ConduitHealth = "unknown" | "healthy" | "degraded" | "blocked" | "offline";

/** Reachability layer — dialect vs underlay split (RUST-5). */
export type ConduitUnderlay = "clearnet" | "tor_socks" | "ssh_tunnel";

/**
 * Bastion local-forward params. Dialect dials `endpoints` (loopback) after tunnel up.
 * @see specs/backend/r-relay-rust-5-ssh-underlay-design-2026-07.md
 */
export type SshTunnelParams = Readonly<{
  bastionHost: string;
  /** Default 22 when omitted on the wire. */
  bastionPort?: number;
  bastionUser: string;
  remoteHost: string;
  remotePort: number;
  /** Default `127.0.0.1` when omitted on the wire. */
  localBindHost?: string;
  localBindPort: number;
  identityFile?: string | null;
}>;

/** User-configured lane — URLs are endpoints, not the product definition. */
export type ConduitDescriptor = Readonly<{
  conduitId: string;
  dialect: ConduitDialect;
  endpoints: ReadonlyArray<string>;
  capabilities: ReadonlyArray<ConduitCapability>;
  networkPolicy: ConduitNetworkPolicy;
  trustTier: ConduitTrustTier;
  enabled: boolean;
  priority: number;
  label?: string;
  underlay?: ConduitUnderlay;
  /** Required when `underlay` is `ssh_tunnel` (RUST-5a). */
  sshTunnel?: SshTunnelParams;
}>;

export type ConduitRuntimeState = Readonly<{
  descriptor: ConduitDescriptor;
  health: ConduitHealth;
  lastEvidenceAtUnixMs?: number;
  lastFailureReason?: string;
  circuitOpenUntilUnixMs?: number;
}>;

const isLoopbackHost = (host: string): boolean => (
  host === "127.0.0.1" || host === "localhost" || host === "::1"
);

const isValidSshTunnelParams = (params: SshTunnelParams): boolean => (
  params.bastionHost.trim().length > 0
  && params.bastionUser.trim().length > 0
  && params.remoteHost.trim().length > 0
  && params.remotePort > 0
  && (params.localBindHost?.trim().length ?? 1) > 0
  && params.localBindPort > 0
);

/**
 * Soft-skip reason mirroring Rust `ssh_configure_skip_reason` (RUST-5a).
 * Returns null when SSH params are present and endpoints match local bind.
 */
export const sshTunnelConfigureSkipReason = (
  descriptor: ConduitDescriptor,
): "ssh_params_missing" | "ssh_endpoint_mismatch" | null => {
  if (descriptor.underlay !== "ssh_tunnel") {
    return null;
  }
  const params = descriptor.sshTunnel;
  if (!params || !isValidSshTunnelParams(params)) {
    return "ssh_params_missing";
  }
  const endpoint = descriptor.endpoints.find((url) => url.trim().length > 0);
  if (!endpoint) {
    return "ssh_endpoint_mismatch";
  }
  let parsed: URL;
  try {
    parsed = new URL(endpoint.trim());
  } catch {
    return "ssh_endpoint_mismatch";
  }
  const host = parsed.hostname;
  const port = parsed.port
    ? Number(parsed.port)
    : (parsed.protocol === "wss:" || parsed.protocol === "https:" ? 443 : 80);
  const bindHost = (params.localBindHost ?? "127.0.0.1").trim();
  const hostOk = host === bindHost || (isLoopbackHost(host) && isLoopbackHost(bindHost));
  if (!hostOk || port !== params.localBindPort) {
    return "ssh_endpoint_mismatch";
  }
  return null;
};
