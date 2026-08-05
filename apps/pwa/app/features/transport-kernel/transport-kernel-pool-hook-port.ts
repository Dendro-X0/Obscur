import { isTransportKernelAuthority } from "./transport-kernel-policy";

/** Transport-kernel owns the canonical UI relay pool hook when authority is active. */
export const isTransportKernelPoolHookOwner = (): boolean => isTransportKernelAuthority();

/**
 * RUST-4c — legacy enhanced-relay-pool orchestrator removed from product selection.
 * Always false; UI routes through conduit mesh / transport-kernel (mesh) only.
 */
export const shouldUseLegacyRelayPoolHook = (): boolean => false;
