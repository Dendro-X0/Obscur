import { isTransportKernelAuthority } from "./transport-kernel-policy";

/** Transport-kernel owns the canonical UI relay pool hook when authority is active. */
export const isTransportKernelPoolHookOwner = (): boolean => isTransportKernelAuthority();

/** Legacy WebSocket pool hook remains on web / when transport-kernel authority is inactive. */
export const shouldUseLegacyRelayPoolHook = (): boolean => !isTransportKernelPoolHookOwner();
