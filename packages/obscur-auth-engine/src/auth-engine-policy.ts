import type { AuthBootPhase, AuthBootSnapshot } from "@dweb/auth/contracts/auth-boot-snapshot";
import type { AuthAssistantPort } from "@dweb/auth/ports/auth-assistant-port";
import type { DeviceUnlockPort } from "@dweb/auth/ports/device-unlock-port";
import type { IdentityRootPort } from "@dweb/auth/ports/identity-root-port";
import type { RegistrationPolicyPort } from "@dweb/auth/ports/registration-policy-port";
import type { RuntimeSessionPort } from "@dweb/auth/ports/runtime-session-port";

/** AUTH-KERN gates complete — auth-engine is runtime authority owner. */
export const AUTH_ENGINE_AUTHORITY_ENABLED = true;

export const isAuthEngineAuthority = (): boolean => AUTH_ENGINE_AUTHORITY_ENABLED;

export const AUTH_ENGINE_BOOT_RESTORE_ENABLED = true;

export const isAuthEngineBootRestoreEnabled = (restoreEligible: boolean): boolean => (
  AUTH_ENGINE_BOOT_RESTORE_ENABLED && restoreEligible
);

export type AuthEnginePorts = Readonly<{
  identityRoot: IdentityRootPort;
  registrationPolicy: RegistrationPolicyPort;
  deviceUnlock: DeviceUnlockPort;
  authAssistant: AuthAssistantPort;
  runtimeSession: RuntimeSessionPort;
}>;

export type AuthEnginePortFactories = Readonly<{
  identityRoot: () => IdentityRootPort;
  registrationPolicy: () => RegistrationPolicyPort;
  deviceUnlock: () => DeviceUnlockPort;
  authAssistant: () => AuthAssistantPort;
  runtimeSession: () => RuntimeSessionPort;
}>;

export const createAuthEnginePorts = (
  factories: AuthEnginePortFactories,
): AuthEnginePorts => ({
  identityRoot: factories.identityRoot(),
  registrationPolicy: factories.registrationPolicy(),
  deviceUnlock: factories.deviceUnlock(),
  authAssistant: factories.authAssistant(),
  runtimeSession: factories.runtimeSession(),
});
