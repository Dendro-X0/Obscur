import type { ConduitRuntimeState, MeshReadiness } from "@obscur/conduit-mesh-contracts";

export const classifyMeshReadiness = (
  conduits: ReadonlyArray<ConduitRuntimeState>,
): MeshReadiness => {
  const publishCapable = conduits.filter((c) => (
    c.descriptor.enabled
    && c.descriptor.capabilities.includes("publish")
  ));
  if (publishCapable.length === 0) {
    return "offline";
  }
  const healthy = publishCapable.filter((c) => c.health === "healthy");
  if (healthy.length > 0) {
    return "healthy";
  }
  const degraded = publishCapable.filter((c) => c.health === "degraded");
  if (degraded.length > 0) {
    return "degraded";
  }
  return "recovering";
};
