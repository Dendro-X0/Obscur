/**
 * Platform rewrite band **K3** — legacy Auth bridge removal criteria.
 * Canonical UI mutation entry remains `useAuthKernelSurfaceActions` → auth-kernel ports.
 * `auth-kernel-legacy-delegates` stays until every criterion below is true.
 *
 * @see specs/backend/platform-boundary-map-2026-11.md (K3)
 * @see docs/program/obscur-auth-kernel-charter-2026-06.md
 */

/** Ordered removal gates — do not delete the bridge while any remain unmet. */
export const AUTH_KERNEL_LEGACY_BRIDGE_REMOVAL_CRITERIA = [
  /** identityRoot / deviceUnlock / runtimeSession own create·import·unlock·lock·signOut without authKernelIdentityActions. */
  "ports_own_mutations_without_authKernelIdentityActions",
  /** Production imports of auth-kernel-legacy-delegates only from auth-kernel adapters (contract). */
  "no_bridge_importers_outside_auth_kernel_adapters",
  /** Boot restore no longer needs seedAuthKernelLockedIdentity / retryAuthKernelNativeSessionUnlock from the bridge. */
  "boot_restore_independent_of_bridge_seed_unlock",
  /** Unlock/create/import L1 contracts + desktop lock/sign-out L2 smoke Pass with ports alone. */
  "l1_l2_auth_mutations_pass_without_bridge",
  /** Maintainer ACK in handoff that authKernelIdentityActions scatter may shrink or move under ports. */
  "maintainer_ack_scatter_shrink",
] as const;

export type AuthKernelLegacyBridgeRemovalCriterion =
  (typeof AUTH_KERNEL_LEGACY_BRIDGE_REMOVAL_CRITERIA)[number];

/**
 * Allowlisted production importers of `auth-kernel-legacy-delegates`
 * (relative to `apps/pwa/app/features/`).
 */
export const AUTH_KERNEL_LEGACY_BRIDGE_ALLOWED_IMPORTERS = [
  "auth-kernel/auth-kernel-identity-root-adapter.ts",
  "auth-kernel/auth-kernel-device-unlock-adapter.ts",
  "auth-kernel/auth-kernel-assistant-adapter.ts",
  "auth-kernel/auth-kernel-bound-profile-auth.ts",
  "auth-kernel/auth-kernel-boot-owner.ts",
] as const;

/** Shell/UI mutation façade — preferred over calling the bridge or authKernelIdentityActions. */
export const AUTH_KERNEL_CANONICAL_MUTATION_ENTRY =
  "auth-kernel/hooks/use-auth-kernel-surface-actions.ts" as const;
