import { isEngineLabStrictMode } from "@/app/engine-lab/engine-lab-policy";
import { isTransportKernelAuthority } from "./transport-kernel-policy";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { isStandaloneLegacyDeletionEnvApprovedForPolicy } from "./transport-kernel-standalone-deletion-gate";

/** Transport-kernel owns canonical relay publish on native authority. */
export const isTransportKernelPublishOwner = (): boolean => isTransportKernelAuthority() && hasNativeRuntime();

/** Legacy standalone publish is allowed only when transport-kernel is not the publish owner. */
export const shouldUseLegacyStandaloneRelayPublish = (): boolean => !isTransportKernelPublishOwner();

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

/** Engine-lab opt-in host publish shim; off by default even in strict mode. */
export const shouldUseHostTransportPublishShim = (): boolean => (
  isEngineLabStrictMode()
  && isTransportKernelPublishOwner()
  && isTransportHostPublishShimEnvEnabled()
);

/** Maintainer Phase D authority flip gate (W49); wired in relay-standalone-publish-port (W50). */
export const shouldUseHostTransportPublishAuthority = (): boolean => (
  isEngineLabStrictMode()
  && isTransportKernelPublishOwner()
  && isTransportHostPublishAuthorityEnvEnabled()
);

/** Host publish routing via authority flip or lab shim (W50). */
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
