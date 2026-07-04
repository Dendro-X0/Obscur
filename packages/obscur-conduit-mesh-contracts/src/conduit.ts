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
}>;

export type ConduitRuntimeState = Readonly<{
  descriptor: ConduitDescriptor;
  health: ConduitHealth;
  lastEvidenceAtUnixMs?: number;
  lastFailureReason?: string;
  circuitOpenUntilUnixMs?: number;
}>;
