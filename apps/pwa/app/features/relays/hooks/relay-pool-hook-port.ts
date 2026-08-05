"use client";

import type { EnhancedRelayPoolResult } from "./enhanced-relay-pool-types";
import { useConduitMeshRelayPool } from "./use-conduit-mesh-relay-pool";

/**
 * Canonical relay pool hook for UI wiring.
 * RUST-4c: conduit mesh only — legacy product orchestrator removed.
 */
export const useRelayPoolRuntime = (urls: ReadonlyArray<string>): EnhancedRelayPoolResult => (
  useConduitMeshRelayPool(urls)
);
