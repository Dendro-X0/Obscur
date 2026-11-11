/**
 * Soft L3 persist hygiene — sticky exclusive private-mesh preset intent.
 * When set, cold load skips mergePublicBootIntoLoopbackOnlyList so Local Dev Mesh
 * Replace-and-apply survives hard reload.
 *
 * @see specs/backend/soft-l3-persist-hygiene-design-2026-11-08.md
 */
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { normalizeWorkspaceRelayUrl } from "@/app/features/groups/services/workspace-relay-url";
import { isLocalLabAssistRelayUrl } from "@/app/features/relays/services/relay-local-lab-adapt";
import {
  getTransportPreset,
  type TransportPreset,
  type TransportPresetId,
} from "./transport-preset-catalog";

const STORAGE_KEY = "obscur.transport.exclusive_preset.v1";

export type ExclusiveIntentRelayRow = Readonly<{
  url: string;
  enabled: boolean;
}>;

const normalizeUrl = (url: string): string => (
  normalizeWorkspaceRelayUrl(url.trim()) || url.trim()
);

const urlsMatch = (left: string, right: string): boolean => (
  normalizeUrl(left) === normalizeUrl(right)
);

const isTransportPresetId = (value: string): value is TransportPresetId => (
  getTransportPreset(value as TransportPresetId) !== undefined
);

export const isExclusivePrivateMeshPreset = (preset: TransportPreset): boolean => (
  preset.category === "private_mesh"
);

export const readExclusiveTransportPresetIntent = (
  profileId?: string,
): TransportPresetId | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const key = getScopedStorageKey(STORAGE_KEY, profileId ?? getResolvedProfileId());
    const raw = window.localStorage.getItem(key);
    if (!raw || !isTransportPresetId(raw)) {
      return null;
    }
    const preset = getTransportPreset(raw);
    if (!preset || !isExclusivePrivateMeshPreset(preset)) {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
};

export const writeExclusiveTransportPresetIntent = (
  presetId: TransportPresetId,
  profileId?: string,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  const preset = getTransportPreset(presetId);
  if (!preset || !isExclusivePrivateMeshPreset(preset)) {
    clearExclusiveTransportPresetIntent(profileId);
    return;
  }
  try {
    const key = getScopedStorageKey(STORAGE_KEY, profileId ?? getResolvedProfileId());
    window.localStorage.setItem(key, presetId);
  } catch {
    // ignore quota / private mode
  }
};

export const clearExclusiveTransportPresetIntent = (profileId?: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const key = getScopedStorageKey(STORAGE_KEY, profileId ?? getResolvedProfileId());
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

/**
 * Sync intent after a Replace-apply of a transport preset.
 * Private-mesh packs set exclusive intent; everything else clears it.
 */
export const syncExclusiveTransportPresetIntentAfterApply = (
  preset: TransportPreset,
  profileId?: string,
): void => {
  if (isExclusivePrivateMeshPreset(preset)) {
    writeExclusiveTransportPresetIntent(preset.id, profileId);
    return;
  }
  clearExclusiveTransportPresetIntent(profileId);
};

/** Clear sticky exclusive intent when the user enables a non-lab remote. */
export const clearExclusiveIntentIfEnablingNonLabRelay = (
  params: Readonly<{ url: string; enabled: boolean }>,
  profileId?: string,
): void => {
  if (!params.enabled) {
    return;
  }
  if (isLocalLabAssistRelayUrl(params.url)) {
    return;
  }
  clearExclusiveTransportPresetIntent(profileId);
};

/**
 * True when stored list should skip public-boot merge:
 * exclusive private-mesh intent is set and every enabled URL belongs to that preset.
 */
export const shouldSkipPublicBootMergeForExclusiveIntent = (
  params: Readonly<{
    intent: TransportPresetId | null;
    relays: ReadonlyArray<ExclusiveIntentRelayRow>;
  }>,
): boolean => {
  if (!params.intent) {
    return false;
  }
  const preset = getTransportPreset(params.intent);
  if (!preset || !isExclusivePrivateMeshPreset(preset)) {
    return false;
  }
  const presetUrls = preset.relays.map(normalizeUrl).filter((url) => url.length > 0);
  if (presetUrls.length === 0) {
    return false;
  }
  const enabled = params.relays
    .filter((relay) => relay.enabled)
    .map((relay) => normalizeUrl(relay.url))
    .filter((url) => url.length > 0);
  if (enabled.length === 0) {
    // All disabled under exclusive intent — still skip public merge; caller may re-enable preset rows.
    return true;
  }
  return enabled.every((url) => presetUrls.some((presetUrl) => urlsMatch(url, presetUrl)));
};

/** When exclusive intent holds and every row is disabled, re-enable the preset's URLs. */
export const reenableExclusivePresetRelays = (
  params: Readonly<{
    intent: TransportPresetId;
    relays: ReadonlyArray<ExclusiveIntentRelayRow>;
  }>,
): Readonly<{ relays: ReadonlyArray<ExclusiveIntentRelayRow>; changed: boolean }> => {
  const preset = getTransportPreset(params.intent);
  if (!preset || !isExclusivePrivateMeshPreset(preset)) {
    return { relays: params.relays, changed: false };
  }
  if (params.relays.some((relay) => relay.enabled)) {
    return { relays: params.relays, changed: false };
  }
  const presetUrls = preset.relays.map(normalizeUrl);
  let changed = false;
  const next = params.relays.map((relay) => {
    if (presetUrls.some((presetUrl) => urlsMatch(relay.url, presetUrl))) {
      if (!relay.enabled) {
        changed = true;
        return { url: normalizeUrl(relay.url) || relay.url, enabled: true };
      }
    }
    return relay;
  });
  for (const presetUrl of presetUrls) {
    const exists = next.some((relay) => urlsMatch(relay.url, presetUrl));
    if (!exists) {
      next.push({ url: presetUrl, enabled: true });
      changed = true;
    }
  }
  return { relays: next, changed };
};
