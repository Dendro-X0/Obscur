/**
 * Cut 12.1 — Continuity M5 linked-device registry (local enroll/revoke).
 * Registry ≠ live multi-device sync · ≠ Continuity Pass · Soft L3 paused.
 * @see specs/backend/cut12-continuity-m5-linked-devices-design-2026-11-10.md
 */

export const CONTINUITY_LINKED_DEVICES_STORAGE_PREFIX = "obscur.continuity.linked_devices.v1";

export type ContinuityLinkedDevice = Readonly<{
  deviceId: string;
  label: string;
  enrolledAtUnixMs: number;
  revokedAtUnixMs?: number;
  platformHint?: string;
}>;

export const getContinuityLinkedDevicesStorageKey = (profileId: string): string => (
  `${CONTINUITY_LINKED_DEVICES_STORAGE_PREFIX}::${profileId}`
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

export const parseContinuityLinkedDevice = (value: unknown): ContinuityLinkedDevice | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.deviceId !== "string"
    || typeof value.label !== "string"
    || typeof value.enrolledAtUnixMs !== "number"
  ) {
    return null;
  }
  return {
    deviceId: value.deviceId,
    label: value.label,
    enrolledAtUnixMs: value.enrolledAtUnixMs,
    revokedAtUnixMs: typeof value.revokedAtUnixMs === "number" ? value.revokedAtUnixMs : undefined,
    platformHint: typeof value.platformHint === "string" ? value.platformHint : undefined,
  };
};

export const parseContinuityLinkedDevices = (
  value: unknown,
): ReadonlyArray<ContinuityLinkedDevice> => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(parseContinuityLinkedDevice)
    .filter((row): row is ContinuityLinkedDevice => row !== null);
};

export const readContinuityLinkedDevices = (
  profileId: string,
): ReadonlyArray<ContinuityLinkedDevice> => {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(getContinuityLinkedDevicesStorageKey(profileId));
  if (!raw) {
    return [];
  }
  try {
    return parseContinuityLinkedDevices(JSON.parse(raw));
  } catch {
    return [];
  }
};

export const writeContinuityLinkedDevices = (
  profileId: string,
  devices: ReadonlyArray<ContinuityLinkedDevice>,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    getContinuityLinkedDevicesStorageKey(profileId),
    JSON.stringify(devices),
  );
};

export const generateContinuityDeviceId = (
  randomUuid: () => string = () => crypto.randomUUID(),
): string => randomUuid();

export const detectContinuityPlatformHint = (
  nav: Pick<Navigator, "platform" | "userAgent"> | undefined = typeof navigator !== "undefined"
    ? navigator
    : undefined,
): string | undefined => {
  if (!nav) {
    return undefined;
  }
  return nav.platform || nav.userAgent.slice(0, 48) || undefined;
};

export const enrollContinuityLinkedDevice = (params: Readonly<{
  profileId: string;
  label?: string;
  deviceId?: string;
  nowUnixMs?: number;
  platformHint?: string;
}>): ContinuityLinkedDevice => {
  const now = params.nowUnixMs ?? Date.now();
  const deviceId = params.deviceId ?? generateContinuityDeviceId();
  const existing = readContinuityLinkedDevices(params.profileId);
  const withoutSame = existing.filter((row) => row.deviceId !== deviceId);
  const next: ContinuityLinkedDevice = {
    deviceId,
    label: params.label?.trim() || `Device ${deviceId.slice(0, 8)}`,
    enrolledAtUnixMs: now,
    platformHint: params.platformHint ?? detectContinuityPlatformHint(),
  };
  writeContinuityLinkedDevices(params.profileId, [...withoutSame, next]);
  return next;
};

export const revokeContinuityLinkedDevice = (params: Readonly<{
  profileId: string;
  deviceId: string;
  nowUnixMs?: number;
}>): ContinuityLinkedDevice | null => {
  const devices = readContinuityLinkedDevices(params.profileId);
  const target = devices.find((row) => row.deviceId === params.deviceId);
  if (!target) {
    return null;
  }
  if (target.revokedAtUnixMs) {
    return target;
  }
  const revoked: ContinuityLinkedDevice = {
    ...target,
    revokedAtUnixMs: params.nowUnixMs ?? Date.now(),
  };
  writeContinuityLinkedDevices(
    params.profileId,
    devices.map((row) => (row.deviceId === params.deviceId ? revoked : row)),
  );
  return revoked;
};

export const listActiveContinuityLinkedDevices = (
  devices: ReadonlyArray<ContinuityLinkedDevice>,
): ReadonlyArray<ContinuityLinkedDevice> => (
  devices.filter((row) => row.revokedAtUnixMs === undefined)
);
