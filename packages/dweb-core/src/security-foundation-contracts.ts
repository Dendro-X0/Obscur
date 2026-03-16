export type SecurityReasonCode =
  | "invalid_input"
  | "invalid_signature"
  | "invalid_session"
  | "session_expired"
  | "replay_rejected"
  | "out_of_order"
  | "unsupported_runtime"
  | "unsupported_token"
  | "offline"
  | "relay_degraded"
  | "storage_unavailable"
  | "integrity_mismatch"
  | "failed";

export type DeliveryReasonCode =
  | SecurityReasonCode
  | "quorum_not_met"
  | "no_writable_relays"
  | "retry_scheduled"
  | "provider_unavailable"
  | "upload_timeout"
  | "upload_provider_failed";

export type CoreResultStatus = "ok" | "partial" | "queued" | "failed" | "unsupported";

export type CoreResult<T> = Readonly<{
  status: CoreResultStatus;
  value?: T;
  reasonCode?: DeliveryReasonCode;
  message?: string;
  retryAtUnixMs?: number;
}>;

export type ProtocolErrorPayload = Readonly<{
  reason: SecurityReasonCode;
  message: string;
  retryable: boolean;
}>;

export type ProtocolCommandResult<T> = Readonly<{
  ok: boolean;
  value?: T;
  error?: ProtocolErrorPayload;
}>;

export type IdentityRootState = Readonly<{
  rootPublicKeyHex: string;
  createdAtUnixMs: number;
  lastRotatedAtUnixMs?: number;
  revision: number;
  status: "sealed" | "available" | "revoked";
}>;

export type DeviceKeyRecord = Readonly<{
  deviceId: string;
  publicKeyHex: string;
  label?: string;
  authorizedAtUnixMs: number;
  revokedAtUnixMs?: number;
  status: "authorized" | "revoked";
}>;

export type SessionKeyState = Readonly<{
  sessionId: string;
  deviceId: string;
  createdAtUnixMs: number;
  expiresAtUnixMs?: number;
  status: "locked" | "unlocked" | "expired" | "revoked";
}>;

export type DeviceAuthorizationRecord = Readonly<{
  id: string;
  rootPublicKeyHex: string;
  devicePublicKeyHex: string;
  issuedAtUnixMs: number;
  expiresAtUnixMs?: number;
  signature: string;
}>;

export type DeviceRevocationResult =
  | Readonly<{ ok: true; deviceId: string; revokedAtUnixMs: number }>
  | Readonly<{ ok: false; reason: SecurityReasonCode; message?: string }>;

export type X3DHHandshakeResult =
  | Readonly<{
      ok: true;
      sessionId: string;
      establishedAtUnixMs: number;
      peerPublicKeyHex: string;
      usedPrekey: boolean;
    }>
  | Readonly<{ ok: false; reason: SecurityReasonCode; message?: string }>;

export type X3DHPreKeyBundle = Readonly<{
  identityKeyHex: string;
  signedPrekeyHex: string;
  oneTimePrekeyHex?: string;
  signatureHex?: string;
}>;

export type X3DHSessionBootstrap = Readonly<{
  sessionId: string;
  rootKeyHex: string;
  sendingChainKeyHex: string;
  receivingChainKeyHex: string;
  establishedAtUnixMs: number;
  usedOneTimePrekey: boolean;
}>;

export type RatchetSessionState = Readonly<{
  sessionId: string;
  peerPublicKeyHex: string;
  rootKeyId: string;
  sendingChainLength: number;
  receivingChainLength: number;
  previousMessageCounter?: number;
  status: "active" | "needs_recovery" | "closed";
}>;

export type RatchetChainState = Readonly<{
  rootKeyHex: string;
  sendingChainKeyHex: string;
  receivingChainKeyHex: string;
  sendCounter: number;
  recvCounter: number;
  previousMessageCounter?: number;
}>;

export type ReplayWindowState = Readonly<{
  highestCounter: number;
  skippedCounters: ReadonlyArray<number>;
}>;

export type EnvelopeVerifyContext = Readonly<{
  sessionId: string;
  messageId: string;
  counter: number;
  envelopeVersion: "legacy" | "v090_x3dr";
  ciphertext: string;
}>;

export type MessageVerifyResult =
  | Readonly<{ ok: true; sessionId: string; messageId: string; verifiedAtUnixMs: number }>
  | Readonly<{ ok: false; reason: SecurityReasonCode; messageId?: string; message?: string }>;

export type RelayCircuitState = "healthy" | "degraded" | "cooling_down" | "unavailable";

export type RelaySnapshot = Readonly<{
  atUnixMs: number;
  configuredRelayUrls: ReadonlyArray<string>;
  writableRelayUrls: ReadonlyArray<string>;
  totalRelayCount: number;
  openRelayCount: number;
  relayCircuitStates?: Readonly<Record<string, RelayCircuitState>>;
}>;

export type PublishOutcome = Readonly<{
  successCount: number;
  totalRelays: number;
  quorumRequired: number;
  metQuorum: boolean;
  failures: ReadonlyArray<Readonly<{ relayUrl: string; error?: string }>>;
  elapsedMs?: number;
}>;

export type RetryPolicyState = Readonly<{
  attempts: number;
  maxAttempts: number;
  nextRetryAtUnixMs?: number;
  lastReasonCode?: DeliveryReasonCode;
}>;

export type QuorumPublishReport = Readonly<{
  successCount: number;
  totalRelays: number;
  metQuorum: boolean;
  failures: ReadonlyArray<Readonly<{ relayUrl: string; error?: string }>>;
  elapsedMs: number;
}>;

export type CheckpointRepairResult = "ok" | "repaired" | "failed";

export type StorageHealthState = Readonly<{
  healthy: boolean;
  reasonCode?: SecurityReasonCode;
  lastCheckedAtUnixMs: number;
  details?: string;
}>;

export type StorageRecoveryReport = Readonly<{
  repaired: boolean;
  recoveredEntries: number;
  durationMs: number;
  reasonCode?: SecurityReasonCode;
  message?: string;
}>;
