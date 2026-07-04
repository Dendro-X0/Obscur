/**
 * AUTH-K-AUTHORITY subtraction manifest — legacy auth scatter retired from restore ownership.
 *
 * @see docs/program/obscur-auth-kernel-charter-2026-06.md §2, §10
 */

/** Legacy modules auth-kernel adapters must not import directly (use ports). */
export const AUTH_KERNEL_FORBIDDEN_KERNEL_IMPORTS = [
  "use-identity",
  "useIdentityInternals",
  "auth-gateway",
  "window-runtime-supervisor",
  "device-trust-service",
] as const;

/** Auth-kernel implementation files checked for forbidden imports (excludes manifest + provider). */
export const AUTH_KERNEL_IMPLEMENTATION_FILES = [
  "auth-kernel-policy.ts",
  "auth-kernel-identity-root-adapter.ts",
  "auth-kernel-device-unlock-adapter.ts",
  "auth-kernel-assistant-adapter.ts",
  "auth-kernel-runtime-session-adapter.ts",
  "auth-kernel-registration-policy-adapter.ts",
  "auth-kernel-sybil-policy-config.ts",
  "auth-kernel-boot-owner.ts",
  "auth-kernel-registration-gate.ts",
  "auth-kernel-registration-throttle.ts",
  "auth-kernel-manual-lock-state.ts",
  "auth-kernel-sign-out-cleanup.ts",
  "auth-kernel-profile-scope.ts",
  "auth-kernel-keychain-presence.ts",
  "auth-kernel-ports.ts",
] as const;

/** Single legacy bridge allowed to import scatter owners. */
export const AUTH_KERNEL_LEGACY_BRIDGE_FILE = (
  "app/features/auth/services/auth-kernel-legacy-delegates.ts"
) as const;

/** All auth-kernel module files (implementation + manifest + barrel + provider). */
export const AUTH_KERNEL_SOURCE_FILES = [
  ...AUTH_KERNEL_IMPLEMENTATION_FILES,
  "auth-kernel-subtraction-manifest.ts",
  "auth-kernel-provider.tsx",
  "index.ts",
] as const;

/**
 * Legacy scatter surfaces — restore/unlock loops subtracted at AUTH-K-AUTHORITY.
 * Gate with code review + `scripts/verify-auth-kernel-boundaries.mjs`.
 */
export const AUTH_KERNEL_LEGACY_SCATTER_FILES = [
  "app/features/auth/hooks/use-identity.ts",
  "app/features/auth/components/auth-gateway.tsx",
  "app/features/auth/services/device-trust-service.ts",
  "app/features/auth/services/session-credential-policy.ts",
  "app/features/runtime/services/window-runtime-supervisor.ts",
  "app/features/profiles/services/desktop-window-boot.ts",
] as const;

/** Tokens that must not reappear in legacy scatter (restore loop expansion). */
export const AUTH_KERNEL_LEGACY_SCATTER_FORBIDDEN_NEW_SYMBOLS = [
  "runAggressiveNativeSessionRestoreOnReload",
  "markReloadSessionRestoreSettled",
  "retryNativeSessionBootstrapAfterProfileReady",
  "shouldAttemptNativeSecureRestore",
] as const;
