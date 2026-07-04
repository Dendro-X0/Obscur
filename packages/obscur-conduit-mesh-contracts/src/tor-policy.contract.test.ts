import { describe, expect, it } from "vitest";

import {
  deriveEffectiveNetworkPolicy,
  filterConduitsByTorPolicy,
  isConduitBlockedByTorPolicy,
  sortConduitsByTorPreference,
} from "@obscur/conduit-mesh-contracts";
import type { ConduitDescriptor } from "@obscur/conduit-mesh-contracts";

const clearnetConduit = (): ConduitDescriptor => ({
  conduitId: "clearnet-custom",
  dialect: "custom",
  endpoints: ["https://mesh.example"],
  capabilities: ["publish"],
  networkPolicy: "clearnet",
  trustTier: "user_configured",
  enabled: true,
  priority: 1,
});

const torRequiredConduit = (): ConduitDescriptor => ({
  conduitId: "team-tor",
  dialect: "team_relay",
  endpoints: ["wss://relay.onion.example"],
  capabilities: ["publish"],
  networkPolicy: "tor_required",
  trustTier: "operator_attested",
  enabled: true,
  priority: 0,
});

describe("conduit-mesh-contracts — tor policy", () => {
  it("blocks tor_required when Tor is not ready", () => {
    expect(isConduitBlockedByTorPolicy(torRequiredConduit(), { configured: true, ready: false })).toBe(true);
  });

  it("allows tor_required when Tor is ready", () => {
    expect(isConduitBlockedByTorPolicy(torRequiredConduit(), { configured: true, ready: true })).toBe(false);
  });

  it("keeps clearnet viable when Tor is down", () => {
    const { viable, torBlocked } = filterConduitsByTorPolicy(
      [torRequiredConduit(), clearnetConduit()],
      { configured: true, ready: false },
    );
    expect(torBlocked.map((c) => c.conduitId)).toEqual(["team-tor"]);
    expect(viable.map((c) => c.conduitId)).toEqual(["clearnet-custom"]);
  });

  it("prefers tor_required when Tor is ready", () => {
    const sorted = sortConduitsByTorPreference(
      [clearnetConduit(), torRequiredConduit()],
      { configured: true, ready: true },
    );
    expect(sorted[0]?.conduitId).toBe("team-tor");
  });

  it("derives effective network policy from conduits and Tor state", () => {
    expect(deriveEffectiveNetworkPolicy(
      [torRequiredConduit()],
      { configured: true, ready: true },
    )).toBe("tor_required");

    expect(deriveEffectiveNetworkPolicy(
      [clearnetConduit()],
      { configured: false, ready: false },
    )).toBe("clearnet");
  });
});
