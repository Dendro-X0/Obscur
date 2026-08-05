/**
 * R-RELAY wire — map transport presets to Rust ConduitDescriptor payloads.
 * @see specs/backend/r-relay-preset-mesh-configure-wire-design-2026-07.md
 */

import { classifyRelayEndpointAdapter } from "./relay-endpoint-adapter";
import type { TransportPreset } from "./transport-preset-catalog";

export type MeshConduitDescriptorWire = Readonly<{
  conduitId: string;
  dialect: "nostr_ws" | "custom" | "team_relay";
  endpoints: ReadonlyArray<string>;
  capabilities: ReadonlyArray<"publish" | "subscribe" | "pull">;
  networkPolicy: "clearnet" | "tor_preferred" | "tor_required";
  trustTier: "operator_attested" | "user_configured" | "public_untrusted";
  enabled: boolean;
  priority: number;
  label?: string;
  underlay?: "clearnet" | "tor_socks" | "ssh_tunnel";
  sshTunnel?: Readonly<{
    bastionHost: string;
    bastionPort?: number;
    bastionUser: string;
    remoteHost: string;
    remotePort: number;
    localBindHost?: string;
    localBindPort: number;
    identityFile?: string | null;
  }>;
}>;

const dialectForUrl = (url: string): MeshConduitDescriptorWire["dialect"] => {
  const kind = classifyRelayEndpointAdapter(url);
  if (kind === "http_mesh" || kind === "tor_mesh") {
    return "custom";
  }
  return "nostr_ws";
};

const trustForUrl = (url: string): MeshConduitDescriptorWire["trustTier"] => {
  const kind = classifyRelayEndpointAdapter(url);
  if (kind === "nostr_public") {
    return "public_untrusted";
  }
  if (kind === "http_mesh" || kind === "private_ws") {
    return "user_configured";
  }
  return "operator_attested";
};

const capabilitiesForDialect = (
  dialect: MeshConduitDescriptorWire["dialect"],
): MeshConduitDescriptorWire["capabilities"] => (
  dialect === "custom"
    ? ["publish", "pull"]
    : ["publish", "subscribe"]
);

export const buildMeshConduitsFromPreset = (
  preset: TransportPreset,
): ReadonlyArray<MeshConduitDescriptorWire> => {
  const networkPolicy: MeshConduitDescriptorWire["networkPolicy"] = preset.requiresTor
    ? "tor_required"
    : "clearnet";
  const sshTunnel = preset.sshTunnel;
  const underlay: MeshConduitDescriptorWire["underlay"] | undefined = sshTunnel
    ? "ssh_tunnel"
    : preset.requiresTor
      ? "tor_socks"
      : "clearnet";

  return preset.relays.map((url, index) => {
    const dialect = dialectForUrl(url);
    return {
      conduitId: `${preset.id}-${index}`,
      dialect,
      endpoints: [url],
      capabilities: capabilitiesForDialect(dialect),
      networkPolicy,
      trustTier: trustForUrl(url),
      enabled: true,
      priority: 100 - index,
      label: preset.id,
      underlay,
      ...(sshTunnel ? { sshTunnel } : {}),
    };
  });
};

export const maxRedundancyForPreset = (preset: TransportPreset): number => (
  preset.transportMode === "redundancy" ? 3 : 1
);
