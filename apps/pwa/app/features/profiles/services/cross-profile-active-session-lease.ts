import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const LEASE_STORAGE_KEY = "obscur.cross_profile.active_session_leases.v1";
export const ACTIVE_SESSION_LEASE_TTL_MS = 12_000;
export const ACTIVE_SESSION_LEASE_HEARTBEAT_MS = 4_000;

export type ActiveSessionLeaseRecord = Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  profileLabel: string;
  windowLabel: string;
  updatedAtUnixMs: number;
}>;

type LeaseMap = Record<string, ActiveSessionLeaseRecord>;

const normalizePublicKeyHex = (value: string): PublicKeyHex | null => {
  const normalized = value.trim().toLowerCase();
  if (normalized.length !== 64) {
    return null;
  }
  return normalized as PublicKeyHex;
};

const readLeaseMap = (): LeaseMap => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(LEASE_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as LeaseMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeLeaseMap = (map: LeaseMap): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(LEASE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // best-effort
  }
};

const PROFILE_REGISTRY_STORAGE_KEY = "obscur.profiles.registry.v1";

const resolveProfileLabel = (profileId: string): string => {
  if (typeof window === "undefined") {
    return profileId;
  }
  try {
    const raw = window.localStorage.getItem(PROFILE_REGISTRY_STORAGE_KEY);
    if (!raw) {
      return profileId;
    }
    const parsed = JSON.parse(raw) as { profiles?: ReadonlyArray<{ profileId?: string; label?: string }> };
    const match = parsed.profiles?.find((profile) => profile.profileId === profileId);
    return match?.label?.trim() || profileId;
  } catch {
    return profileId;
  }
};

const isLeaseFresh = (lease: ActiveSessionLeaseRecord, nowMs: number): boolean => (
  nowMs - lease.updatedAtUnixMs <= ACTIVE_SESSION_LEASE_TTL_MS
);

export const findActiveSessionLeaseForAccount = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  excludeProfileId?: string;
  nowMs?: number;
}>): ActiveSessionLeaseRecord | null => {
  const target = normalizePublicKeyHex(params.publicKeyHex);
  if (!target) {
    return null;
  }
  const nowMs = params.nowMs ?? Date.now();
  const excludeProfileId = params.excludeProfileId?.trim();
  const map = readLeaseMap();
  const lease = map[target];
  if (!lease || !isLeaseFresh(lease, nowMs)) {
    return null;
  }
  if (excludeProfileId && lease.profileId === excludeProfileId) {
    return null;
  }
  return lease;
};

export const claimActiveSessionLease = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  windowLabel: string;
}>): void => {
  const publicKeyHex = normalizePublicKeyHex(params.publicKeyHex);
  if (!publicKeyHex || typeof window === "undefined") {
    return;
  }
  const profileId = params.profileId.trim();
  const map = readLeaseMap();
  map[publicKeyHex] = {
    publicKeyHex,
    profileId,
    profileLabel: resolveProfileLabel(profileId),
    windowLabel: params.windowLabel.trim() || "main",
    updatedAtUnixMs: Date.now(),
  };
  writeLeaseMap(map);
};

export const touchActiveSessionLease = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
}>): void => {
  const publicKeyHex = normalizePublicKeyHex(params.publicKeyHex);
  if (!publicKeyHex || typeof window === "undefined") {
    return;
  }
  const profileId = params.profileId.trim();
  const map = readLeaseMap();
  const existing = map[publicKeyHex];
  if (!existing || existing.profileId !== profileId) {
    return;
  }
  map[publicKeyHex] = {
    ...existing,
    updatedAtUnixMs: Date.now(),
  };
  writeLeaseMap(map);
};

export const releaseActiveSessionLease = (params: Readonly<{
  publicKeyHex: PublicKeyHex | null | undefined;
  profileId: string;
}>): void => {
  const publicKeyHex = params.publicKeyHex
    ? normalizePublicKeyHex(params.publicKeyHex)
    : null;
  if (!publicKeyHex || typeof window === "undefined") {
    return;
  }
  const profileId = params.profileId.trim();
  const map = readLeaseMap();
  const existing = map[publicKeyHex];
  if (!existing || existing.profileId !== profileId) {
    return;
  }
  delete map[publicKeyHex];
  writeLeaseMap(map);
};

export class AccountActiveInOtherProfileWindowError extends Error {
  readonly code = "ACCOUNT_ACTIVE_IN_OTHER_PROFILE_WINDOW" as const;

  readonly detail: Readonly<{
    incomingPublicKeyHex: PublicKeyHex;
    activeProfileId: string;
    activeProfileLabel: string;
    activeWindowLabel: string;
  }>;

  constructor(detail: AccountActiveInOtherProfileWindowError["detail"]) {
    super(
      `This account is already unlocked in ${detail.activeProfileLabel}. `
      + "Sign out there first, or use that profile window.",
    );
    this.name = "AccountActiveInOtherProfileWindowError";
    this.detail = detail;
  }
}

export const assertAccountNotActiveInOtherProfileWindow = (params: Readonly<{
  incomingPublicKeyHex: PublicKeyHex;
  currentProfileId: string;
}>): void => {
  const lease = findActiveSessionLeaseForAccount({
    publicKeyHex: params.incomingPublicKeyHex,
    excludeProfileId: params.currentProfileId,
  });
  if (!lease) {
    return;
  }
  throw new AccountActiveInOtherProfileWindowError({
    incomingPublicKeyHex: params.incomingPublicKeyHex,
    activeProfileId: lease.profileId,
    activeProfileLabel: lease.profileLabel,
    activeWindowLabel: lease.windowLabel,
  });
};
