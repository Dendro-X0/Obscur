import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { isChromePerfPlaneActive } from "@/app/features/runtime/experiment-shell-policy";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

const LEASE_STORAGE_KEY = "obscur.cross_profile.active_session_leases.v1";
/** Must stay in sync with Rust `ACTIVE_SESSION_LEASE_TTL_MS`. */
export const ACTIVE_SESSION_LEASE_TTL_MS = 60_000;
/** N1: TTL 60s — 30s heartbeat halves lease IPC vs 12s (E19 picker storm). */
export const ACTIVE_SESSION_LEASE_HEARTBEAT_MS = 30_000;
/** Skip bridge touch IPC inside this window (matches Rust TOUCH_PERSIST_MIN_INTERVAL_MS). */
const TOUCH_INVOKE_COALESCE_MS = 25_000;
/** Short coalesce window for picker list polls across focus/interval races. */
const LIST_LEASES_CACHE_TTL_MS = 8_000;

const lastTouchInvokeAtMsByKey = new Map<string, number>();

export type ActiveSessionLeaseRecord = Readonly<{
  publicKeyHex: PublicKeyHex;
  profileId: string;
  profileLabel: string;
  windowLabel: string;
  updatedAtUnixMs: number;
}>;

type LeaseMap = Record<string, ActiveSessionLeaseRecord>;

let listLeasesCache: Readonly<{
  atMs: number;
  leases: ReadonlyArray<ActiveSessionLeaseRecord>;
}> | null = null;

/** Coalesce concurrent list callers (effect remount / focus races miss the TTL cache). */
let listLeasesInFlight: Promise<ReadonlyArray<ActiveSessionLeaseRecord>> | null = null;

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
  // Chrome fault-scan: picker lease poll must not open IPC (soft stubs still flood PostMessage).
  if (isChromePerfPlaneActive()) {
    return [];
  }
  const resolvedNowMs = nowMs ?? Date.now();
  if (
    listLeasesCache
    && resolvedNowMs - listLeasesCache.atMs < LIST_LEASES_CACHE_TTL_MS
  ) {
    return listLeasesCache.leases.filter((lease) => isLeaseFresh(lease, resolvedNowMs));
  }
  if (listLeasesInFlight) {
    const leases = await listLeasesInFlight;
    return leases.filter((lease) => isLeaseFresh(lease, resolvedNowMs));
  }
  listLeasesInFlight = (async (): Promise<ReadonlyArray<ActiveSessionLeaseRecord>> => {
    let leases: ReadonlyArray<ActiveSessionLeaseRecord>;
    if (hasNativeRuntime()) {
      const result = await invokeNativeCommand<ReadonlyArray<ActiveSessionLeaseRecord>>(
        "desktop_list_active_session_leases",
        {},
      );
      if (result.ok) {
        leases = (result.value ?? []).filter((lease) => isLeaseFresh(lease, resolvedNowMs));
        listLeasesCache = { atMs: resolvedNowMs, leases };
        return leases;
      }
    }
    const map = readLeaseMap();
    leases = Object.values(map).filter((lease) => isLeaseFresh(lease, resolvedNowMs));
    listLeasesCache = { atMs: resolvedNowMs, leases };
    return leases;
  })();
  try {
    return await listLeasesInFlight;
  } finally {
    listLeasesInFlight = null;
  }
};

const invalidateListLeasesCache = (): void => {
  listLeasesCache = null;
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
      invalidateListLeasesCache();
      return;
    }
  }
  claimActiveSessionLease(params);
  invalidateListLeasesCache();
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
  const profileId = params.profileId.trim();
  const coalesceKey = `${publicKeyHex}:${profileId}`;
  const nowMs = Date.now();
  const lastTouchAtMs = lastTouchInvokeAtMsByKey.get(coalesceKey) ?? 0;
  if (nowMs - lastTouchAtMs < TOUCH_INVOKE_COALESCE_MS) {
    return;
  }
  lastTouchInvokeAtMsByKey.set(coalesceKey, nowMs);
  if (hasNativeRuntime()) {
    const result = await invokeNativeCommand<void>("desktop_touch_active_session_lease", {
      publicKeyHex,
      profileId,
    });
    if (result.ok) {
      invalidateListLeasesCache();
      return;
    }
  }
  touchActiveSessionLease(params);
  invalidateListLeasesCache();
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
      invalidateListLeasesCache();
      return;
    }
  }
  releaseActiveSessionLease(params);
  invalidateListLeasesCache();
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

/** Drop local lease map — F5 and cold boot restore must not inherit a stale lease. */
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
