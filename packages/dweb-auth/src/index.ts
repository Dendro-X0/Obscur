export type { AuthBootPhase, AuthBootSnapshot } from "./contracts/auth-boot-snapshot";
export type { AuthUnlockContext, AuthUnlockOptions } from "./contracts/auth-unlock-options";
export { resolveStaySignedInFromOptions } from "./contracts/auth-unlock-options";
export type {
  AuthRegistrationMode,
  AuthSybilPolicySnapshot,
  AuthSybilTier,
} from "./contracts/auth-sybil-policy";
export { DEFAULT_AUTH_SYBIL_POLICY } from "./contracts/auth-sybil-policy";
export type {
  AuthIdentityMatch,
  AuthSessionDiagnosticSnapshot,
  AuthSessionOverallStatus,
} from "./contracts/auth-diagnostic";
export type { AuthReasonCode, AuthResult, AuthResultStatus } from "./contracts/auth-result";
export { authFailed, authOk } from "./contracts/auth-result";

export type {
  CreateIdentityParams,
  IdentityRootPort,
  ImportIdentityParams,
  ReadStoredIdentityParams,
  StoredIdentitySnapshot,
} from "./ports/identity-root-port";
export { IDENTITY_ROOT_PORT_ID } from "./ports/identity-root-port";

export type {
  EvaluateRegistrationParams,
  RegistrationEvaluation,
  RegistrationPolicyPort,
} from "./ports/registration-policy-port";
export { REGISTRATION_POLICY_PORT_ID } from "./ports/registration-policy-port";

export type {
  DeviceUnlockPort,
  UnlockOutcome,
  UnlockWithPassphraseParams,
  UnlockWithPrivateKeyParams,
} from "./ports/device-unlock-port";
export { DEVICE_UNLOCK_PORT_ID } from "./ports/device-unlock-port";

export type {
  RuntimeSessionPort,
  RuntimeSessionStatus,
} from "./ports/runtime-session-port";
export { RUNTIME_SESSION_PORT_ID } from "./ports/runtime-session-port";

export type { SessionCredentialPolicySnapshot } from "./policy/session-credential-policy-contract";
export {
  createDesktopShellPolicySnapshot,
  DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY,
} from "./policy/session-credential-policy-contract";

export {
  AUTH_SYBIL_TIER_POLICIES,
  evaluateAuthRegistrationPolicy,
  resolveAuthSybilPolicyForTier,
} from "./policy/registration-policy-engine";

export type {
  AuthAssistantEntry,
  AuthAssistantUnlockParams,
  AuthAssistantVaultPayload,
} from "./contracts/auth-assistant-entry";
export { AUTH_ASSISTANT_PAYLOAD_VERSION } from "./contracts/auth-assistant-entry";

export type {
  AuthAssistantPort,
  SaveAssistantUnlockParams,
} from "./ports/auth-assistant-port";
export { AUTH_ASSISTANT_PORT_ID } from "./ports/auth-assistant-port";

export {
  decodeAuthAssistantVaultPayload,
  encodeAuthAssistantVaultPayload,
} from "./policy/auth-assistant-vault-codec";

export const AUTH_KERNEL_PACKAGE_VERSION = "auth-k0" as const;

export const AUTH_KERNEL_PORT_IDS = [
  "obscur.auth.identity-root",
  "obscur.auth.registration-policy",
  "obscur.auth.device-unlock",
  "obscur.auth.runtime-session",
] as const;

export type AuthKernelPortId = (typeof AUTH_KERNEL_PORT_IDS)[number];
