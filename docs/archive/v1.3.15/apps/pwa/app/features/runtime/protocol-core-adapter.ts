import type {
  DeviceAuthorizationRecord,
  DeviceRevocationResult,
  IdentityRootState,
  MessageVerifyResult,
  ProtocolCommandResult,
  QuorumPublishReport,
  RatchetSessionState,
  SessionKeyState,
  StorageHealthState,
  StorageRecoveryReport,
  X3DHHandshakeResult,
} from "@dweb/core/security-foundation-contracts";
import type { AdapterResult } from "./adapter-result";
import { failedResult, okResult, unsupportedResult } from "./adapter-result";
import { invokeNativeCommand } from "./native-adapters";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { getV090RolloutPolicy } from "@/app/features/settings/services/v090-rollout-policy";

export type ProtocolCoreAdapter = Readonly<{
  getIdentityRootState: () => Promise<AdapterResult<IdentityRootState>>;
  getSessionState: (sessionId: string) => Promise<AdapterResult<SessionKeyState>>;
  authorizeDevice: (devicePublicKeyHex: string) => Promise<AdapterResult<DeviceAuthorizationRecord>>;
  revokeDevice: (deviceId: string) => Promise<AdapterResult<DeviceRevocationResult>>;
  runX3DHHandshake: (peerPublicKeyHex: string) => Promise<AdapterResult<X3DHHandshakeResult>>;
  getRatchetSession: (sessionId: string) => Promise<AdapterResult<RatchetSessionState>>;
  verifyMessageEnvelope: (params: Readonly<{ sessionId: string; messageId: string; envelope: string; counter?: number }>) => Promise<AdapterResult<MessageVerifyResult>>;
  publishWithQuorum: (payload: string, relayUrls: ReadonlyArray<string>) => Promise<AdapterResult<QuorumPublishReport>>;
  checkStorageHealth: () => Promise<AdapterResult<StorageHealthState>>;
  runStorageRecovery: () => Promise<AdapterResult<StorageRecoveryReport>>;
}>;

const getPolicy = () => getV090RolloutPolicy(PrivacySettingsService.getSettings());

const requireProtocolCore = <T>(): AdapterResult<T> | null => {
  const policy = getPolicy();
  if (!policy.protocolCoreEnabled) {
    return unsupportedResult("Protocol core is disabled by rollout policy.");
  }
  return null;
};

const requireX3dh = <T>(): AdapterResult<T> | null => {
  const policy = getPolicy();
  if (!policy.protocolCoreEnabled) {
    return unsupportedResult("Protocol core is disabled by rollout policy.");
  }
  if (!policy.x3dhRatchetEnabled) {
    return unsupportedResult("X3DH + ratchet path is disabled by rollout policy.");
  }
  return null;
};

const invokeProtocolCommand = async <T>(
  command: string,
  args?: Record<string, unknown>
): Promise<AdapterResult<T>> => {
  const native = await invokeNativeCommand<ProtocolCommandResult<T>>(command, args);
  if (!native.ok) {
    return native;
  }
  const payload = native.value;
  if (payload.ok && typeof payload.value !== "undefined") {
    return okResult(payload.value);
  }
  if (payload.error) {
    if (payload.error.reason === "unsupported_runtime" || payload.error.reason === "unsupported_token") {
      return unsupportedResult(payload.error.message);
    }
    return failedResult(payload.error.message);
  }
  return failedResult(`Malformed protocol command response: ${command}`);
};

export const protocolCoreAdapter: ProtocolCoreAdapter = {
  getIdentityRootState: async () => {
    const gated = requireProtocolCore<IdentityRootState>();
    if (gated) return gated;
    return invokeProtocolCommand<IdentityRootState>("protocol_get_identity_root_state");
  },
  getSessionState: async (sessionId) => {
    const gated = requireProtocolCore<SessionKeyState>();
    if (gated) return gated;
    return invokeProtocolCommand<SessionKeyState>("protocol_get_session_state", { session_id: sessionId });
  },
  authorizeDevice: async (devicePublicKeyHex) => {
    const gated = requireProtocolCore<DeviceAuthorizationRecord>();
    if (gated) return gated;
    return invokeProtocolCommand<DeviceAuthorizationRecord>("protocol_authorize_device", { device_public_key_hex: devicePublicKeyHex });
  },
  revokeDevice: async (deviceId) => {
    const gated = requireProtocolCore<DeviceRevocationResult>();
    if (gated) return gated;
    return invokeProtocolCommand<DeviceRevocationResult>("protocol_revoke_device", { device_id: deviceId });
  },
  runX3DHHandshake: async (peerPublicKeyHex) => {
    const gated = requireX3dh<X3DHHandshakeResult>();
    if (gated) return gated;
    return invokeProtocolCommand<X3DHHandshakeResult>("protocol_x3dh_handshake", {
      peer_public_key_hex: peerPublicKeyHex,
      x3dh_enabled: true,
    });
  },
  getRatchetSession: async (sessionId) => {
    const gated = requireProtocolCore<RatchetSessionState>();
    if (gated) return gated;
    return invokeProtocolCommand<RatchetSessionState>("protocol_get_ratchet_session", { session_id: sessionId });
  },
  verifyMessageEnvelope: async (params) => {
    const gated = requireX3dh<MessageVerifyResult>();
    if (gated) return gated;
    return invokeProtocolCommand<MessageVerifyResult>("protocol_verify_message_envelope", {
      session_id: params.sessionId,
      message_id: params.messageId,
      envelope: params.envelope,
      counter: params.counter,
      envelope_version: "v090_x3dr",
      x3dh_enabled: true,
    });
  },
  publishWithQuorum: async (payload, relayUrls) => {
    const gated = requireProtocolCore<QuorumPublishReport>();
    if (gated) return gated;
    return invokeProtocolCommand<QuorumPublishReport>("protocol_publish_with_quorum", {
      payload,
      relay_urls: relayUrls,
    });
  },
  checkStorageHealth: async () => {
    const gated = requireProtocolCore<StorageHealthState>();
    if (gated) return gated;
    return invokeProtocolCommand<StorageHealthState>("protocol_check_storage_health");
  },
  runStorageRecovery: async () => {
    const gated = requireProtocolCore<StorageRecoveryReport>();
    if (gated) return gated;
    return invokeProtocolCommand<StorageRecoveryReport>("protocol_run_storage_recovery");
  },
};
