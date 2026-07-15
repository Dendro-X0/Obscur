import type { ConduitDialect } from "@obscur/conduit-mesh-contracts";
import { resolveRelayPoolConduitDescriptors } from "@obscur/conduit-mesh";

import { isConduitMeshPoolExplicitlyDisabled, isConduitMeshPoolHookOwner } from "./conduit-mesh-pool-hook-port";
import { shouldUseLegacyRelayPoolHook } from "./transport-kernel-pool-hook-port";

export type ConduitMeshPoolOwner =
  | "conduit_mesh"
  | "transport_kernel_enhanced"
  | "legacy_websocket";

export type ConduitMeshSettingsEndpoint = Readonly<{
  url: string;
  enabled: boolean;
  dialect: ConduitDialect;
}>;

export type ConduitMeshSettingsSnapshot = Readonly<{
  poolOwner: ConduitMeshPoolOwner;
  meshOptOut: boolean;
  endpoints: ReadonlyArray<ConduitMeshSettingsEndpoint>;
  enabledEndpointCount: number;
  dmEnabledEndpointCount: number;
}>;

export const resolveConduitMeshPoolOwner = (): ConduitMeshPoolOwner => {
  if (shouldUseLegacyRelayPoolHook()) {
    return "legacy_websocket";
  }
  if (isConduitMeshPoolHookOwner()) {
    return "conduit_mesh";
  }
  return "transport_kernel_enhanced";
};

const dialectOrder: Record<ConduitDialect, number> = {
  nostr_ws: 0,
  team_relay: 1,
  custom: 2,
  coordination_http: 3,
  coordination_sse: 4,
  store_forward: 5,
  lan_mdns: 6,
};

export const buildConduitMeshSettingsSnapshot = (
  relays: ReadonlyArray<Readonly<{ url: string; enabled: boolean }>>,
): ConduitMeshSettingsSnapshot => {
  const descriptors = resolveRelayPoolConduitDescriptors(relays.map((relay) => relay.url));
  const endpoints: ConduitMeshSettingsEndpoint[] = relays.map((relay, index) => ({
    url: relay.url,
    enabled: relay.enabled,
    dialect: descriptors[index]?.dialect ?? "custom",
  }));

  endpoints.sort((left, right) => {
    if (left.enabled !== right.enabled) {
      return left.enabled ? -1 : 1;
    }
    const dialectDelta = dialectOrder[left.dialect] - dialectOrder[right.dialect];
    if (dialectDelta !== 0) {
      return dialectDelta;
    }
    return left.url.localeCompare(right.url);
  });

  const enabledEndpointCount = endpoints.filter((entry) => entry.enabled).length;

  return {
    poolOwner: resolveConduitMeshPoolOwner(),
    meshOptOut: isConduitMeshPoolExplicitlyDisabled(),
    endpoints,
    enabledEndpointCount,
    dmEnabledEndpointCount: enabledEndpointCount,
  };
};

export const conduitMeshDialectI18nKey = (dialect: ConduitDialect): string => (
  `settings.conduits.dialect.${dialect}`
);

export const conduitMeshPoolOwnerI18nKey = (owner: ConduitMeshPoolOwner): string => (
  `settings.conduits.poolOwner.${owner}`
);
