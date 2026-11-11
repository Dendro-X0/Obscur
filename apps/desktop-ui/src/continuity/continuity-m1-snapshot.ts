/**
 * Cut 8.1 — Vite-native Continuity M1 snapshot (T0–T2).
 * Not EncryptedAccountBackupPayload — no apps/pwa import · ≠ Continuity Pass.
 * @see specs/backend/cut8-native-continuity-m1-adapter-design-2026-11-10.md
 */

export const CONTINUITY_M1_SNAPSHOT_FORMAT = "obscur.continuity_m1.v1" as const;
export const CONTINUITY_M1_SEALED_FORMAT = "obscur.continuity_m1.sealed.v1" as const;

export type ContinuityM1PeerTrust = Readonly<{
  acceptedPeers: ReadonlyArray<string>;
  mutedPeers: ReadonlyArray<string>;
}>;

export type ContinuityM1IdentityUnlock = Readonly<{
  /** Private key wrapped with Continuity passphrase (same scheme as device unlock). */
  encryptedPrivateKey: string;
  username?: string;
}>;

export type ContinuityM1Profile = Readonly<{
  username?: string;
}>;

export type ContinuityM1RelayEntry = Readonly<{
  url: string;
  enabled: boolean;
}>;

export type ContinuityM1LinkedDevice = Readonly<{
  deviceId: string;
  label: string;
  enrolledAtUnixMs: number;
  revokedAtUnixMs?: number;
  platformHint?: string;
}>;

/**
 * Sealed plaintext payload. T0–T2 field slots always present on successful export.
 * T3/T4 intentionally absent → inventory honesty stays partial.
 * Cut 12: optional linkedDevices (T0 enroll residue) — ≠ live sync · ≠ Continuity Pass.
 */
export type ContinuityM1Snapshot = Readonly<{
  version: 1;
  format: typeof CONTINUITY_M1_SNAPSHOT_FORMAT;
  createdAtUnixMs: number;
  publicKeyHex: string;
  identityUnlock: ContinuityM1IdentityUnlock;
  profile: ContinuityM1Profile;
  peerTrust: ContinuityM1PeerTrust;
  privacySettings: Readonly<Record<string, unknown>>;
  relayList: ReadonlyArray<ContinuityM1RelayEntry>;
  uiSettings: Readonly<Record<string, unknown>>;
  linkedDevices?: ReadonlyArray<ContinuityM1LinkedDevice>;
}>;

export type ContinuityM1SealedEnvelope = Readonly<{
  version: 1;
  format: typeof CONTINUITY_M1_SEALED_FORMAT;
  alg: "pbkdf2-sha256-aes-gcm";
  iterations: number;
  saltB64: string;
  ivB64: string;
  ciphertextB64: string;
  /** Non-secret hint for file pickers — not authoritative. */
  publicKeyHexHint?: string;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
};

/** C0 field names always present on a valid ContinuityM1Snapshot (T3/T4 omitted). */
export const presentContinuityM1FieldNames = (
  _snapshot: ContinuityM1Snapshot,
): ReadonlyArray<string> => ([
  "publicKeyHex",
  "identityUnlock",
  "profile",
  "peerTrust",
  "privacySettings",
  "relayList",
  "uiSettings",
]);

export const parseContinuityM1Snapshot = (value: unknown): ContinuityM1Snapshot | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (value.version !== 1 || value.format !== CONTINUITY_M1_SNAPSHOT_FORMAT) {
    return null;
  }
  if (typeof value.createdAtUnixMs !== "number" || typeof value.publicKeyHex !== "string") {
    return null;
  }
  if (!isRecord(value.identityUnlock) || typeof value.identityUnlock.encryptedPrivateKey !== "string") {
    return null;
  }
  const profile = isRecord(value.profile) ? value.profile : {};
  const peerTrust = isRecord(value.peerTrust) ? value.peerTrust : {};
  const privacySettings = isRecord(value.privacySettings) ? value.privacySettings : {};
  const uiSettings = isRecord(value.uiSettings) ? value.uiSettings : {};
  const relayListRaw = Array.isArray(value.relayList) ? value.relayList : [];
  const relayList: ContinuityM1RelayEntry[] = relayListRaw.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.url !== "string") {
      return [];
    }
    return [{ url: entry.url, enabled: entry.enabled !== false }];
  });

  const linkedDevicesRaw = Array.isArray(value.linkedDevices) ? value.linkedDevices : [];
  const linkedDevices: ContinuityM1LinkedDevice[] = linkedDevicesRaw.flatMap((entry) => {
    if (
      !isRecord(entry)
      || typeof entry.deviceId !== "string"
      || typeof entry.label !== "string"
      || typeof entry.enrolledAtUnixMs !== "number"
    ) {
      return [];
    }
    return [{
      deviceId: entry.deviceId,
      label: entry.label,
      enrolledAtUnixMs: entry.enrolledAtUnixMs,
      revokedAtUnixMs: typeof entry.revokedAtUnixMs === "number" ? entry.revokedAtUnixMs : undefined,
      platformHint: typeof entry.platformHint === "string" ? entry.platformHint : undefined,
    }];
  });

  return {
    version: 1,
    format: CONTINUITY_M1_SNAPSHOT_FORMAT,
    createdAtUnixMs: value.createdAtUnixMs,
    publicKeyHex: value.publicKeyHex,
    identityUnlock: {
      encryptedPrivateKey: value.identityUnlock.encryptedPrivateKey,
      username: typeof value.identityUnlock.username === "string"
        ? value.identityUnlock.username
        : undefined,
    },
    profile: {
      username: typeof profile.username === "string" ? profile.username : undefined,
    },
    peerTrust: {
      acceptedPeers: asStringArray(peerTrust.acceptedPeers),
      mutedPeers: asStringArray(peerTrust.mutedPeers),
    },
    privacySettings,
    relayList,
    uiSettings,
    linkedDevices: linkedDevices.length > 0 ? linkedDevices : undefined,
  };
};

export const parseContinuityM1SealedEnvelope = (
  value: unknown,
): ContinuityM1SealedEnvelope | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (value.version !== 1 || value.format !== CONTINUITY_M1_SEALED_FORMAT) {
    return null;
  }
  if (value.alg !== "pbkdf2-sha256-aes-gcm") {
    return null;
  }
  if (
    typeof value.iterations !== "number"
    || typeof value.saltB64 !== "string"
    || typeof value.ivB64 !== "string"
    || typeof value.ciphertextB64 !== "string"
  ) {
    return null;
  }
  return {
    version: 1,
    format: CONTINUITY_M1_SEALED_FORMAT,
    alg: "pbkdf2-sha256-aes-gcm",
    iterations: value.iterations,
    saltB64: value.saltB64,
    ivB64: value.ivB64,
    ciphertextB64: value.ciphertextB64,
    publicKeyHexHint: typeof value.publicKeyHexHint === "string"
      ? value.publicKeyHexHint
      : undefined,
  };
};
