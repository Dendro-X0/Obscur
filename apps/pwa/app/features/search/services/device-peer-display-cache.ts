"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { seedProfileMetadataCache } from "@/app/features/profile/hooks/use-profile-metadata";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { discoveryCache } from "./discovery-cache";
import { resolvedIdentityCache } from "./resolved-identity-cache";

const CACHE_PATH = "peer-display/cache.v1.json";
const CACHE_VERSION = 1 as const;
const MAX_ENTRIES = 300;
const BROWSER_FALLBACK_KEY = "obscur.peer_display.device_cache.v1";
/** Cross-window notice so other Tauri profile webviews re-hydrate after an upsert. */
export const PEER_DISPLAY_DEVICE_CACHE_UPDATED_EVENT = "obscur://peer-display-device-cache-updated";

export type DevicePeerDisplayEntry = Readonly<{
  pubkey: string;
  displayName?: string;
  avatarUrl?: string;
  updatedAtUnixMs: number;
}>;

type DevicePeerDisplayCacheState = Readonly<{
  version: typeof CACHE_VERSION;
  entries: ReadonlyArray<DevicePeerDisplayEntry>;
}>;

const emptyState = (): DevicePeerDisplayCacheState => ({
  version: CACHE_VERSION,
  entries: [],
});

const normalizePubkey = (value: string): string | null => {
  const trimmed = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(trimmed) ? trimmed : null;
};

const toText = (bytes: Uint8Array): string => {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder().decode(bytes);
  }
  return String.fromCharCode(...bytes);
};

const toBytes = (text: string): Uint8Array => {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text);
  }
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    out[i] = text.charCodeAt(i);
  }
  return out;
};

const parseState = (raw: string): DevicePeerDisplayCacheState => {
  try {
    const parsed = JSON.parse(raw) as DevicePeerDisplayCacheState;
    if (parsed?.version !== CACHE_VERSION || !Array.isArray(parsed.entries)) {
      return emptyState();
    }
    return {
      version: CACHE_VERSION,
      entries: parsed.entries.filter((entry) => (
        typeof entry?.pubkey === "string"
        && normalizePubkey(entry.pubkey) !== null
        && typeof entry.updatedAtUnixMs === "number"
      )),
    };
  } catch {
    return emptyState();
  }
};

const readBrowserFallback = (): DevicePeerDisplayCacheState => {
  if (typeof window === "undefined") {
    return emptyState();
  }
  try {
    const raw = window.localStorage.getItem(BROWSER_FALLBACK_KEY);
    return raw ? parseState(raw) : emptyState();
  } catch {
    return emptyState();
  }
};

const writeBrowserFallback = (state: DevicePeerDisplayCacheState): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(BROWSER_FALLBACK_KEY, JSON.stringify(state));
  } catch {
    // Quota / private mode — best-effort only.
  }
};

const readNativeState = async (): Promise<DevicePeerDisplayCacheState | null> => {
  if (!hasNativeRuntime()) {
    return null;
  }
  try {
    const { readFile, exists, mkdir } = await import("@tauri-apps/plugin-fs");
    const { BaseDirectory } = await import("@tauri-apps/api/path");
    await mkdir("peer-display", { baseDir: BaseDirectory.AppData, recursive: true });
    if (!(await exists(CACHE_PATH, { baseDir: BaseDirectory.AppData }))) {
      return emptyState();
    }
    const bytes = await readFile(CACHE_PATH, { baseDir: BaseDirectory.AppData });
    return parseState(toText(bytes));
  } catch {
    return emptyState();
  }
};

const writeNativeState = async (state: DevicePeerDisplayCacheState): Promise<boolean> => {
  if (!hasNativeRuntime()) {
    return false;
  }
  try {
    const { writeFile, mkdir } = await import("@tauri-apps/plugin-fs");
    const { BaseDirectory } = await import("@tauri-apps/api/path");
    await mkdir("peer-display", { baseDir: BaseDirectory.AppData, recursive: true });
    await writeFile(CACHE_PATH, toBytes(JSON.stringify(state)), {
      baseDir: BaseDirectory.AppData,
      create: true,
    });
    return true;
  } catch {
    return false;
  }
};

const readState = async (): Promise<DevicePeerDisplayCacheState> => {
  const native = await readNativeState();
  if (native) {
    return native;
  }
  return readBrowserFallback();
};

const writeState = async (state: DevicePeerDisplayCacheState): Promise<void> => {
  const wroteNative = await writeNativeState(state);
  if (!wroteNative) {
    writeBrowserFallback(state);
  }
};

const applyEntryToRuntimeCaches = (entry: DevicePeerDisplayEntry): void => {
  const pubkey = normalizePubkey(entry.pubkey);
  if (!pubkey) {
    return;
  }
  const existing = discoveryCache.getProfile(pubkey);
  const displayName = entry.displayName?.trim()
    || existing?.displayName?.trim()
    || existing?.name?.trim()
    || undefined;
  const avatarUrl = entry.avatarUrl?.trim() || existing?.picture?.trim() || undefined;
  if (!displayName && !avatarUrl) {
    return;
  }
  discoveryCache.upsertProfile({
    pubkey,
    displayName,
    name: displayName || existing?.name,
    picture: avatarUrl,
    about: existing?.about,
    nip05: existing?.nip05,
    inviteCode: existing?.inviteCode,
  });
  if (displayName) {
    const resolved = resolvedIdentityCache.getByPubkey(pubkey);
    if (!resolved?.display?.trim()) {
      resolvedIdentityCache.upsert({
        pubkey,
        display: displayName,
        source: "text",
        confidence: "cached_only",
      });
    }
  }
  seedProfileMetadataCache({
    pubkey: pubkey as PublicKeyHex,
    displayName,
    avatarUrl,
  });
};

/** Upsert one peer into the device-shared cache (crosses Tauri profile webview partitions). */
export const upsertDevicePeerDisplay = async (params: Readonly<{
  pubkey: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}>): Promise<boolean> => {
  const pubkey = normalizePubkey(params.pubkey);
  if (!pubkey) {
    return false;
  }
  const displayName = params.displayName?.trim() || undefined;
  const avatarUrl = params.avatarUrl?.trim() || undefined;
  if (!displayName && !avatarUrl) {
    return false;
  }

  const state = await readState();
  const now = Date.now();
  const existing = state.entries.find((entry) => entry.pubkey === pubkey);
  const nextEntry: DevicePeerDisplayEntry = {
    pubkey,
    displayName: displayName || existing?.displayName,
    avatarUrl: avatarUrl || existing?.avatarUrl,
    updatedAtUnixMs: now,
  };
  const without = state.entries.filter((entry) => entry.pubkey !== pubkey);
  const nextState: DevicePeerDisplayCacheState = {
    version: CACHE_VERSION,
    entries: [nextEntry, ...without].slice(0, MAX_ENTRIES),
  };
  await writeState(nextState);
  applyEntryToRuntimeCaches(nextEntry);
  void notifyPeerDisplayDeviceCacheUpdated();
  return true;
};

const notifyPeerDisplayDeviceCacheUpdated = async (): Promise<void> => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.dispatchEvent(new CustomEvent(PEER_DISPLAY_DEVICE_CACHE_UPDATED_EVENT));
  } catch {
    // Ignore DOM event failures.
  }
  if (!hasNativeRuntime()) {
    return;
  }
  try {
    const { emit } = await import("@tauri-apps/api/event");
    await emit(PEER_DISPLAY_DEVICE_CACHE_UPDATED_EVENT, { updatedAtUnixMs: Date.now() });
  } catch {
    // Best-effort cross-window notice only.
  }
};

/** Load device-shared peer labels into discovery / metadata for this webview. */
export const hydrateRuntimeFromDevicePeerDisplayCache = async (): Promise<number> => {
  const state = await readState();
  let applied = 0;
  for (const entry of state.entries) {
    applyEntryToRuntimeCaches(entry);
    applied += 1;
  }
  return applied;
};

/** Re-hydrate when another profile window publishes display data (or this tab focuses). */
export const subscribePeerDisplayDeviceCacheUpdates = (
  onUpdate: () => void,
): (() => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const onDom = (): void => {
    onUpdate();
  };
  const onFocus = (): void => {
    onUpdate();
  };
  const onVisibility = (): void => {
    if (document.visibilityState === "visible") {
      onUpdate();
    }
  };
  window.addEventListener(PEER_DISPLAY_DEVICE_CACHE_UPDATED_EVENT, onDom);
  window.addEventListener("focus", onFocus);
  document.addEventListener("visibilitychange", onVisibility);

  let unlistenNative: (() => void) | null = null;
  if (hasNativeRuntime()) {
    void import("@tauri-apps/api/event")
      .then(({ listen }) => listen(PEER_DISPLAY_DEVICE_CACHE_UPDATED_EVENT, () => {
        onUpdate();
      }))
      .then((unlisten) => {
        unlistenNative = unlisten;
      })
      .catch(() => {
        // Non-IPC shells / vitest.
      });
  }

  return (): void => {
    window.removeEventListener(PEER_DISPLAY_DEVICE_CACHE_UPDATED_EVENT, onDom);
    window.removeEventListener("focus", onFocus);
    document.removeEventListener("visibilitychange", onVisibility);
    unlistenNative?.();
  };
};

export const devicePeerDisplayCacheInternals = {
  CACHE_PATH,
  BROWSER_FALLBACK_KEY,
  parseState,
  applyEntryToRuntimeCaches,
};
