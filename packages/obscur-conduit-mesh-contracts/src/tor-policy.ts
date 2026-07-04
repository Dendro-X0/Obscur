import type { ConduitDescriptor, ConduitNetworkPolicy } from "./conduit";

/** Host-supplied Tor readiness — mesh does not probe SOCKS directly in C3. */
export type MeshTorRuntimeState = Readonly<{
  configured: boolean;
  ready: boolean;
  proxyUrl?: string;
}>;

export const DEFAULT_MESH_TOR_STATE: MeshTorRuntimeState = {
  configured: false,
  ready: false,
};

export const isTorPolicyConduit = (
  policy: ConduitNetworkPolicy,
): boolean => policy !== "clearnet";

export const isConduitBlockedByTorPolicy = (
  descriptor: ConduitDescriptor,
  torState: MeshTorRuntimeState,
): boolean => (
  descriptor.networkPolicy === "tor_required" && !torState.ready
);

export type FilterConduitsByTorPolicyResult = Readonly<{
  viable: ReadonlyArray<ConduitDescriptor>;
  torBlocked: ReadonlyArray<ConduitDescriptor>;
}>;

export const filterConduitsByTorPolicy = (
  conduits: ReadonlyArray<ConduitDescriptor>,
  torState: MeshTorRuntimeState,
): FilterConduitsByTorPolicyResult => {
  const viable: ConduitDescriptor[] = [];
  const torBlocked: ConduitDescriptor[] = [];

  for (const conduit of conduits) {
    if (isConduitBlockedByTorPolicy(conduit, torState)) {
      torBlocked.push(conduit);
    } else {
      viable.push(conduit);
    }
  }

  return { viable, torBlocked };
};

export const deriveEffectiveNetworkPolicy = (
  conduits: ReadonlyArray<ConduitDescriptor>,
  torState: MeshTorRuntimeState,
): "clearnet" | "tor_preferred" | "tor_required" => {
  const hasTorRequired = conduits.some((c) => c.networkPolicy === "tor_required");
  const hasTorPreferred = conduits.some((c) => c.networkPolicy === "tor_preferred");

  if (hasTorRequired && torState.ready) {
    return "tor_required";
  }
  if ((hasTorRequired || hasTorPreferred || torState.configured) && torState.ready) {
    return "tor_preferred";
  }
  if (hasTorRequired || hasTorPreferred || torState.configured) {
    return "tor_preferred";
  }
  return "clearnet";
};

/** When Tor is ready, prefer tor_required then tor_preferred before clearnet (stable sort). */
export const sortConduitsByTorPreference = (
  conduits: ReadonlyArray<ConduitDescriptor>,
  torState: MeshTorRuntimeState,
): ReadonlyArray<ConduitDescriptor> => {
  if (!torState.ready) {
    return conduits;
  }

  const policyRank = (policy: ConduitNetworkPolicy): number => {
    switch (policy) {
      case "tor_required":
        return 0;
      case "tor_preferred":
        return 1;
      case "clearnet":
      default:
        return 2;
    }
  };

  return [...conduits].sort((a, b) => {
    const rankDiff = policyRank(a.networkPolicy) - policyRank(b.networkPolicy);
    if (rankDiff !== 0) return rankDiff;
    return a.priority - b.priority;
  });
};

export const resolveTorBlockedFailureReason = (
  torBlocked: ReadonlyArray<ConduitDescriptor>,
  torState: MeshTorRuntimeState,
): "tor_unreachable" | "no_viable_conduit" => {
  if (torBlocked.length > 0 && !torState.ready) {
    return "tor_unreachable";
  }
  return "no_viable_conduit";
};
