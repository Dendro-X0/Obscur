export { AUTH_KERNEL_BAND, AUTH_KERNEL_KERN_GATES_COMPLETE, isAuthKernelAuthority } from "./auth-kernel-policy";
export { useAuthKernelSurfaceActions } from "./hooks/use-auth-kernel-surface-actions";
export { createAuthKernelIdentityRootPort } from "./auth-kernel-identity-root-adapter";
export { createAuthKernelPorts, type AuthKernelPorts } from "./auth-kernel-ports";
export {
  AuthKernelProvider,
  useAuthKernel,
  useAuthKernelOptional,
  useAuthKernelPorts,
  type AuthKernelContextValue,
} from "./auth-kernel-provider";
export {
  AUTH_KERNEL_FORBIDDEN_KERNEL_IMPORTS,
  AUTH_KERNEL_IMPLEMENTATION_FILES,
  AUTH_KERNEL_LEGACY_SCATTER_FILES,
  AUTH_KERNEL_LEGACY_SCATTER_FORBIDDEN_NEW_SYMBOLS,
  AUTH_KERNEL_SOURCE_FILES,
} from "./auth-kernel-subtraction-manifest";
