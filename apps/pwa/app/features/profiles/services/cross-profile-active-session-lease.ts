import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

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

const leaseMatchesCurrentWindow = (
  lease: ActiveSessionLeaseRecord,
  excludeProfileId?: string,
  excludeWindowLabel?: string,
): boolean => {
  const profileId = excludeProfileId?.trim();
  const windowLabel = excludeWindowLabel?.trim();
  if (!profileId || !windowLabel) {
    return false;
  }
  return lease.profileId === profileId && lease.windowLabel === windowLabel;
};

const findActiveSessionLeaseFromMap = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  excludeProfileId?: string;
  excludeWindowLabel?: string;
  nowMs?: number;
}>): ActiveSessionLeaseRecord | null => {
  const target = normalizePublicKeyHex(params.publicKeyHex);
  if (!target) {
    return null;
  }
  const nowMs = params.nowMs ?? Date.now();
  const map = readLeaseMap();
  const lease = map[target];
  if (!lease || !isLeaseFresh(lease, nowMs)) {
    return null;
  }
  if (leaseMatchesCurrentWindow(lease, params.excludeProfileId, params.excludeWindowLabel)) {
    return null;
  }
  return lease;
};

const findActiveSessionLeaseNative = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  excludeProfileId?: string;
  excludeWindowLabel?: string;
}>): Promise<ActiveSessionLeaseRecord | null> => {
  const result = await invokeNativeCommand<ActiveSessionLeaseRecord | null>(
    "desktop_find_active_session_lease",
    {
      publicKeyHex: params.publicKeyHex,
      excludeProfileId: params.excludeProfileId?.trim() || null,
      excludeWindowLabel: params.excludeWindowLabel?.trim() || null,
    },
  );
  if (!result.ok) {
    return findActiveSessionLeaseFromMap(params);
  }
  return result.value ?? null;
};

export const findActiveSessionLeaseForAccount = (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  excludeProfileId?: string;
  excludeWindowLabel?: string;
  nowMs?: number;
}>): ActiveSessionLeaseRecord | null => findActiveSessionLeaseFromMap(params);

export const findActiveSessionLeaseForAccountAsync = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  excludeProfileId?: string;
  excludeWindowLabel?: string;
  nowMs?: number;
}>): Promise<ActiveSessionLeaseRecord | null> => {
  if (hasNativeRuntime()) {
    return findActiveSessionLeaseNative(params);
  }
  return findActiveSessionLeaseFromMap(params);
};

export const listActiveSessionLeasesAsync = async (nowMs?: number): Promise<ReadonlyArray<ActiveSessionLeaseRecord>> => {
  const resolvedNowMs = nowMs ?? Date.now();
  if (hasNativeRuntime()) {
    const result = await invokeNativeCommand<ReadonlyArray<ActiveSessionLeaseRecord>>(
      "desktop_list_active_session_leases",
      {},
    );
    if (result.ok) {
      return (result.value ?? []).filter((lease) => isLeaseFresh(lease, resolvedNowMs));
    }
  }
  const map = readLeaseMap();
  return Object.values(map).filter((lease) => isLeaseFresh(lease, resolvedNowMs));
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

export const claimActiveSessionLeaseAsync = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  windowLabel: string;
}>): Promise<void> => {
  const publicKeyHex = normalizePublicKeyHex(params.publicKeyHex);
  if (!publicKeyHex) {
    return;
  }
  const profileId = params.profileId.trim();
  const record: ActiveSessionLeaseRecord = {
    publicKeyHex,
    profileId,
    profileLabel: resolveProfileLabel(profileId),
    windowLabel: params.windowLabel.trim() || "main",
    updatedAtUnixMs: Date.now(),
  };
  if (hasNativeRuntime()) {
    const result = await invokeNativeCommand<void>("desktop_claim_active_session_lease", { record });
    if (result.ok) {
      return;
    }
  }
  claimActiveSessionLease(params);
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

export const touchActiveSessionLeaseAsync = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
}>): Promise<void> => {
  const publicKeyHex = normalizePublicKeyHex(params.publicKeyHex);
  if (!publicKeyHex) {
    return;
  }
  if (hasNativeRuntime()) {
    const result = await invokeNativeCommand<void>("desktop_touch_active_session_lease", {
      publicKeyHex,
      profileId: params.profileId.trim(),
    });
    if (result.ok) {
      return;
    }
  }
  touchActiveSessionLease(params);
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

export const releaseActiveSessionLeaseAsync = async (params: Readonly<{
  publicKeyHex: PublicKeyHex | null | undefined;
  profileId: string;
}>): Promise<void> => {
  const publicKeyHex = params.publicKeyHex
    ? normalizePublicKeyHex(params.publicKeyHex)
    : null;
  if (!publicKeyHex) {
    return;
  }
  if (hasNativeRuntime()) {
    const result = await invokeNativeCommand<void>("desktop_release_active_session_lease", {
      publicKeyHex,
      profileId: params.profileId.trim(),
    });
    if (result.ok) {
      return;
    }
  }
  releaseActiveSessionLease(params);
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

/** Same-window manual reload (F5) must not inherit a stale cross-profile lease. */
export const clearActiveSessionLeasesForPageReload = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(LEASE_STORAGE_KEY);
  } catch {
    // best-effort
  }
};

export const assertAccountNotActiveInOtherProfileWindow = (params: Readonly<{
  incomingPublicKeyHex: PublicKeyHex;
  currentProfileId: string;
  currentWindowLabel?: string;
}>): void => {
  const lease = findActiveSessionLeaseForAccount({
    publicKeyHex: params.incomingPublicKeyHex,
    excludeProfileId: params.currentProfileId,
    excludeWindowLabel: params.currentWindowLabel,
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

export const assertAccountNotActiveInOtherProfileWindowAsync = async (params: Readonly<{
  incomingPublicKeyHex: PublicKeyHex;
  currentProfileId: string;
  currentWindowLabel?: string;
}>): Promise<void> => {
  const lease = await findActiveSessionLeaseForAccountAsync({
    publicKeyHex: params.incomingPublicKeyHex,
    excludeProfileId: params.currentProfileId,
    excludeWindowLabel: params.currentWindowLabel,
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
