/**
 * R-RELAY-RUST-1c — map Rust MeshSnapshotJson → TransportSnapshot.
 * Evidence-backed readiness only; UI must not invent connected state.
 */

import type { EngineScope } from "@obscur/engine-contracts";
import type {
  TransportPhase,
  TransportReadiness,
  TransportSnapshot,
} from "./transport-types";

export type RustMeshPhase =
  | "booting"
  | "connecting"
  | "healthy"
  | "degraded"
  | "recovering"
  | "offline"
  | "fatal";

export type RustMeshReadiness = "healthy" | "degraded" | "recovering" | "offline";

/** Mirrors apps/desktop/src-tauri/src/mesh/snapshot.rs MeshSnapshotJson (camelCase). */
export type RustMeshSnapshot = Readonly<{
  profileId: string;
  revision: number;
  phase: RustMeshPhase;
  readiness: RustMeshReadiness;
  enabledEndpointUrls: ReadonlyArray<string>;
  activeConduitIds: ReadonlyArray<string>;
  writableConduitCount: number;
  subscribableConduitCount: number;
  blockedConduitCount: number;
  pendingOutboundCount: number;
  meshSchedulerOwnsFailover: boolean;
  lastFailureReason?: string;
  updatedAtUnixMs: number;
}>;

const toTransportPhase = (phase: RustMeshPhase): TransportPhase => {
  switch (phase) {
    case "booting":
      return "booting";
    case "connecting":
      return "connecting";
    case "healthy":
      return "healthy";
    case "degraded":
      return "degraded";
    case "recovering":
      return "recovering";
    case "fatal":
      return "fatal";
    case "offline":
    default:
      return "offline";
  }
};

const toTransportReadiness = (readiness: RustMeshReadiness): TransportReadiness => {
  switch (readiness) {
    case "healthy":
      return "healthy";
    case "degraded":
      return "degraded";
    case "recovering":
      return "recovering";
    case "offline":
    default:
      return "offline";
  }
};

export const mapRustMeshSnapshotToTransportSnapshot = (params: Readonly<{
  mesh: RustMeshSnapshot;
  scope: EngineScope;
}>): TransportSnapshot => {
  const { mesh, scope } = params;
  return {
    scope,
    phase: toTransportPhase(mesh.phase),
    revision: mesh.revision,
    enabledRelayUrls: [...mesh.enabledEndpointUrls],
    activeSubscriptionCount: mesh.subscribableConduitCount,
    pendingOutboundCount: mesh.pendingOutboundCount,
    updatedAtUnixMs: mesh.updatedAtUnixMs,
    meshSchedulerOwnsFailover: mesh.meshSchedulerOwnsFailover,
    recovery: {
      readiness: toTransportReadiness(mesh.readiness),
      writableRelayCount: mesh.writableConduitCount,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: mesh.subscribableConduitCount,
      writeBlockedRelayCount: mesh.blockedConduitCount,
      coolingDownRelayCount: 0,
      recoveryAttemptCount: 0,
      lastFailureReason: mesh.lastFailureReason,
      fallbackRelayUrls: [],
    },
  };
};
