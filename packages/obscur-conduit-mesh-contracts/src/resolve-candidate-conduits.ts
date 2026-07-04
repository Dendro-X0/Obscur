import type { ConduitDescriptor } from "./conduit";
import type { MeshEnvelope } from "./envelope";

/**
 * Policy helper — select conduits for an envelope without dialect-specific logic.
 * C2 runtime uses this; kept in contracts for testable policy documentation.
 */
export const resolveCandidateConduits = (
  conduits: ReadonlyArray<ConduitDescriptor>,
  envelope: MeshEnvelope,
): ReadonlyArray<ConduitDescriptor> => {
  const allowed = envelope.allowedConduitIds;
  const forbidden = new Set(envelope.forbiddenConduitIds ?? []);

  return conduits
    .filter((c) => c.enabled)
    .filter((c) => !forbidden.has(c.conduitId))
    .filter((c) => !allowed || allowed.length === 0 || allowed.includes(c.conduitId))
    .filter((c) => c.capabilities.includes("publish"))
    .sort((a, b) => a.priority - b.priority);
};
