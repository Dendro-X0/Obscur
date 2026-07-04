import type { AuthAssistantPort, DeviceUnlockPort, IdentityRootPort, RegistrationPolicyPort, RuntimeSessionPort } from "@dweb/auth";
import { createAuthEnginePorts, type AuthEnginePorts } from "@obscur/auth-engine";
import { createAuthKernelAssistantPort } from "./auth-kernel-assistant-adapter";
import { createAuthKernelDeviceUnlockPort } from "./auth-kernel-device-unlock-adapter";
import { createAuthKernelIdentityRootPort } from "./auth-kernel-identity-root-adapter";
import { createAuthKernelRegistrationPolicyPort } from "./auth-kernel-registration-policy-adapter";
import { createAuthKernelRuntimeSessionPort } from "./auth-kernel-runtime-session-adapter";

export type AuthKernelPorts = AuthEnginePorts;

export const createAuthKernelPorts = (): AuthKernelPorts => createAuthEnginePorts({
  identityRoot: createAuthKernelIdentityRootPort,
  registrationPolicy: createAuthKernelRegistrationPolicyPort,
  deviceUnlock: createAuthKernelDeviceUnlockPort,
  authAssistant: createAuthKernelAssistantPort,
  runtimeSession: createAuthKernelRuntimeSessionPort,
});

export type {
  AuthAssistantPort,
  DeviceUnlockPort,
  IdentityRootPort,
  RegistrationPolicyPort,
  RuntimeSessionPort,
};
