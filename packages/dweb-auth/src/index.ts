/**
 * Prefer `@dweb/auth/contracts/*`, `@dweb/auth/ports/*`, `@dweb/auth/policy/*`.
 * Root keeps auth-kernel port id constants + boot snapshot type for host adapters.
 */
export type { AuthBootPhase, AuthBootSnapshot } from "./contracts/auth-boot-snapshot";

export const AUTH_KERNEL_PACKAGE_VERSION = "auth-k0" as const;

export const AUTH_KERNEL_PORT_IDS = [
  "obscur.auth.identity-root",
  "obscur.auth.registration-policy",
  "obscur.auth.device-unlock",
  "obscur.auth.runtime-session",
] as const;

export type AuthKernelPortId = (typeof AUTH_KERNEL_PORT_IDS)[number];
