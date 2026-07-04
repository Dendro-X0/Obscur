"use client";

import { useMemo } from "react";
import type { EnhancedRelayPoolResult } from "./enhanced-relay-pool-types";
import { shouldUseConduitMeshRelayPoolHook } from "@/app/features/transport-kernel/conduit-mesh-pool-hook-port";
import { shouldUseLegacyRelayPoolHook } from "@/app/features/transport-kernel/transport-kernel-pool-hook-port";
import { useLegacyEnhancedRelayPool } from "./enhanced-relay-pool-port";
import { useConduitMeshRelayPool } from "./use-conduit-mesh-relay-pool";
import { useTransportKernelRelayPool } from "./use-transport-kernel-relay-pool";

const INERT_RELAY_URLS: ReadonlyArray<string> = [];

/**
 * Canonical relay pool hook for UI wiring.
 * Tri-route: legacy WebSocket pool | Conduit Mesh pool | transport-kernel enhanced pool.
 */
export const useRelayPoolRuntime = (urls: ReadonlyArray<string>): EnhancedRelayPoolResult => {
  const useLegacy = shouldUseLegacyRelayPoolHook();
  const useConduitMesh = shouldUseConduitMeshRelayPoolHook();

  const legacyUrls = useMemo(
    () => (useLegacy ? urls : INERT_RELAY_URLS),
    [useLegacy, urls],
  );
  const meshUrls = useMemo(
    () => (useConduitMesh ? urls : INERT_RELAY_URLS),
    [useConduitMesh, urls],
  );
  const kernelUrls = useMemo(
    () => ((!useLegacy && !useConduitMesh) ? urls : INERT_RELAY_URLS),
    [useLegacy, useConduitMesh, urls],
  );

  const legacyPool = useLegacyEnhancedRelayPool(legacyUrls);
  const meshPool = useConduitMeshRelayPool(meshUrls);
  const kernelPool = useTransportKernelRelayPool(kernelUrls);

  if (useLegacy) return legacyPool;
  if (useConduitMesh) return meshPool;
  return kernelPool;
};
