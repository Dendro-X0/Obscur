/**
 * Best-effort desktop configureMeshConduits after preset apply / reset.
 * Web and missing host: no-op. Failures must not undo local relay list writes.
 * RUST-4a: records meshSchedulerOwnsFailover gate from configure outcome.
 */

import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  createTauriEngineHost,
  isTauriEngineHostAvailable,
} from "@obscur/engine-host/tauri";

import {
  buildMeshConduitsFromPreset,
  maxRedundancyForPreset,
} from "./build-mesh-conduits-from-preset";
import {
  extractMeshSchedulerOwnsFailover,
  meshSchedulerOwnsFailover,
  setMeshSchedulerOwnsFailover,
} from "./mesh-scheduler-failover-gate";
import type { TransportPreset } from "./transport-preset-catalog";

export type ApplyRustMeshConfigureParams = Readonly<{
  profileId: string;
  preset: TransportPreset;
  torReady?: boolean;
  torConfigured?: boolean;
  connect?: boolean;
  host?: HostEnginePort;
}>;

export type ApplyRustMeshConfigureResult = Readonly<{
  attempted: boolean;
  ok: boolean;
  errorMessage?: string;
  data?: unknown;
  meshSchedulerOwnsFailover?: boolean;
}>;

export const applyRustMeshConfigureFromPreset = async (
  params: ApplyRustMeshConfigureParams,
): Promise<ApplyRustMeshConfigureResult> => {
  const profileId = params.profileId.trim();
  if (!profileId) {
    return { attempted: false, ok: false, errorMessage: "missing_profile_id" };
  }

  const hostAvailable = params.host ? true : isTauriEngineHostAvailable();
  if (!hostAvailable && !params.host) {
    return { attempted: false, ok: false, errorMessage: "host_unavailable" };
  }

  const host = params.host ?? createTauriEngineHost();
  const conduits = buildMeshConduitsFromPreset(params.preset);

  try {
    const result = await host.invoke({
      engine: "transport",
      method: "configureMeshConduits",
      scope: { profileId },
      payload: {
        conduits,
        maxRedundancy: maxRedundancyForPreset(params.preset),
        torReady: params.torReady,
        torConfigured: params.torConfigured,
        connect: params.connect ?? true,
      },
    });
    const owns = extractMeshSchedulerOwnsFailover(result.data);
    if (typeof owns === "boolean") {
      setMeshSchedulerOwnsFailover(profileId, owns);
    } else if (result.ok && conduits.length > 0) {
      setMeshSchedulerOwnsFailover(profileId, true);
    }
    return {
      attempted: true,
      ok: result.ok,
      errorMessage: result.errorMessage,
      data: result.data,
      meshSchedulerOwnsFailover: meshSchedulerOwnsFailover(profileId) || undefined,
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      errorMessage: error instanceof Error ? error.message : "configure_mesh_failed",
    };
  }
};
