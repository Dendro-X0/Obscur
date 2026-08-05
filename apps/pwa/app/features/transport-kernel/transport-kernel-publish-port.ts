import { isEngineLabStrictMode } from "@/app/engine-lab/engine-lab-policy";
import { isDevLabEnabled } from "@/app/engine-lab/dev-lab-tombstone-policy";
import { isTransportKernelAuthority } from "./transport-kernel-policy";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { isStandaloneLegacyDeletionEnvApprovedForPolicy } from "./transport-kernel-standalone-deletion-gate";

/**
 * Transport-kernel owns canonical relay publish on native authority.
 * Heuristic “22 writers” (CodaCtrl) are mostly pool hooks / freeze packages —
 * do not add a second EVENT publish owner without subtracting legacy standalone.
 * @see specs/backend/relay-publish-dual-owner-clarify-design-2026-07.md
 * @see specs/backend/relay-publish-legacy-quarantine-design-2026-07.md
 * @see specs/backend/relay-publish-lab-shim-tombstone-design-2026-07.md
 * @see specs/backend/web-legacy-path-removal-design-2026-08.md
 */
export const isTransportKernelPublishOwner = (): boolean => isTransportKernelAuthority() && hasNativeRuntime();

/**
 * Browser-pool standalone EVENT publish — retired.
 * Production web is disabled (`NativeRuntimeGate`); Tauri is the only ship surface.
 * Localhost harness must use transport-kernel / mesh — not `relay-browser-pool-runtime`
 * sockets (old dual path vs SQLite / conduit mesh).
 */
export const shouldUseLegacyStandaloneRelayPublish = (): boolean => false;

const isTransportHostPublishShimEnvEnabled = (): boolean => (
  process.env.NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_SHIM === "1"
);

const isTransportHostPublishAuthorityEnvEnabled = (): boolean => (
  process.env.NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_AUTHORITY === "1"
);

/** Mirrors Rust lab gate for network publish path selection (W42). */
export const isTransportHostPublishNetworkEnvEnabled = (): boolean => (
  process.env.NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK === "1"
);

/**
 * Host publish shim — lab-only and Dev Lab tombstoned (`isDevLabEnabled` always false).
 * Env alone must not open a second EVENT path on product/parity builds.
 */
export const shouldUseHostTransportPublishShim = (): boolean => (
  isDevLabEnabled()
  && isEngineLabStrictMode()
  && isTransportKernelPublishOwner()
  && isTransportHostPublishShimEnvEnabled()
);

/**
 * Host publish authority flip — same Dev Lab tombstone as shim (W49/W50).
 */
export const shouldUseHostTransportPublishAuthority = (): boolean => (
  isDevLabEnabled()
  && isEngineLabStrictMode()
  && isTransportKernelPublishOwner()
  && isTransportHostPublishAuthorityEnvEnabled()
);

/** Host publish routing via authority flip or lab shim (W50) — product: always false. */
export const shouldRouteHostTransportPublish = (): boolean => (
  shouldUseHostTransportPublishAuthority() || shouldUseHostTransportPublishShim()
);

/** W57: fail-closed when maintainer deletion approval env is on (requires W54 PASS sign-off). */
export const shouldBlockStandaloneLegacyPublishFallback = (): boolean => (
  isStandaloneLegacyDeletionEnvApprovedForPolicy()
);

/** W63: delegate native-owner routing to subtracted port module during deletion rehearsal. */
export const shouldRouteSubtractedStandalonePublishPort = (): boolean => (
  shouldBlockStandaloneLegacyPublishFallback()
);
