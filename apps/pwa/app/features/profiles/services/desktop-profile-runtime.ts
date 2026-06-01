"use client";

import { useSyncExternalStore } from "react";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { logAppEvent } from "@/app/shared/log-app-event";
import { ProfileRegistryService } from "./profile-registry-service";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { parseProfileIdFromWindowLabel } from "./desktop-profile-window-label";
import {
  mirrorDesktopWindowBootPayloadToSyncScope,
  readDesktopWindowBootPayload,
} from "./desktop-window-boot-payload";
import type {
  ProfileId,
  ProfileIsolationSnapshot,
  ProfileSummary,
} from "./profile-isolation-contracts";
import { setProfileScopeOverride } from "./profile-scope";

const DEFAULT_PROFILE_SNAPSHOT: ProfileIsolationSnapshot = {
  currentWindow: {
    windowLabel: "main",
    profileId: "default",
    profileLabel: "Default",
    launchMode: "existing",
  },
  profiles: [{
    profileId: "default",
    label: "Default",
    createdAtUnixMs: 0,
    lastUsedAtUnixMs: 0,
  }],
  windowBindings: [{
    windowLabel: "main",
    profileId: "default",
    profileLabel: "Default",
    launchMode: "existing",
  }],
};

type Listener = () => void;
type ProfileCommandOptions = Readonly<{
  timeoutMs?: number;
}>;

const PROFILE_COMMAND_TIMEOUT_MS = 10_000;
const PROFILE_SNAPSHOT_TIMEOUT_MS = 25_000;
const LAST_KNOWN_WINDOW_PROFILE_ID_STORAGE_KEY = "obscur.desktop.window_profile.last_known.v1";
const MAIN_WINDOW_LABEL = "main";

const lastKnownWindowProfileIdStorageKey = (windowLabel: string): string => (
  `${LAST_KNOWN_WINDOW_PROFILE_ID_STORAGE_KEY}::${windowLabel.trim() || MAIN_WINDOW_LABEL}`
);

let refreshInFlightPromise: Promise<ProfileIsolationSnapshot> | null = null;
let lastRefreshError: string | null = null;

/** Clears in-flight native refresh state after a full window reload or logout. */
export const resetDesktopProfileRefreshState = (): void => {
  refreshInFlightPromise = null;
  lastRefreshError = null;
};

const getLastKnownWindowProfileId = (windowLabel: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(lastKnownWindowProfileIdStorageKey(windowLabel));
    return raw && raw.trim().length > 0 ? raw.trim() : null;
  } catch {
    return null;
  }
};

const setLastKnownWindowProfileId = (windowLabel: string, profileId: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(lastKnownWindowProfileIdStorageKey(windowLabel), profileId);
  } catch {
    // Best-effort only.
  }
};

const syncNativeProfilesIntoRegistry = (snapshot: ProfileIsolationSnapshot): void => {
  snapshot.profiles.forEach((profile) => {
    ProfileRegistryService.ensureProfile(profile.profileId, profile.label);
  });
};

const createFallbackSnapshot = (windowLabel = MAIN_WINDOW_LABEL): ProfileIsolationSnapshot => {
  try {
    const registryState = ProfileRegistryService.getState();
    const lastKnownProfileId = getLastKnownWindowProfileId(windowLabel);
    const activeProfileId = lastKnownProfileId ?? registryState.activeProfileId;
    let activeProfile = registryState.profiles.find((profile) => profile.profileId === activeProfileId);

    if (!activeProfile && lastKnownProfileId) {
      activeProfile = {
        profileId: lastKnownProfileId,
        label: lastKnownProfileId,
        createdAtUnixMs: 0,
        lastUsedAtUnixMs: 0,
        status: "inactive",
      };
    }

    if (!activeProfile) {
      activeProfile = registryState.profiles.find((profile) => profile.profileId === registryState.activeProfileId)
        ?? registryState.profiles[0];
    }

    if (!activeProfile) {
      return DEFAULT_PROFILE_SNAPSHOT;
    }

    return {
      currentWindow: {
        windowLabel,
        profileId: activeProfile.profileId,
        profileLabel: activeProfile.label,
        launchMode: "existing",
      },
      profiles: registryState.profiles.some((profile) => profile.profileId === activeProfile.profileId)
        ? registryState.profiles.map((profile) => ({
          profileId: profile.profileId,
          label: profile.label,
          createdAtUnixMs: profile.createdAtUnixMs,
          lastUsedAtUnixMs: profile.lastUsedAtUnixMs,
        }))
        : [{
          profileId: activeProfile.profileId,
          label: activeProfile.label,
          createdAtUnixMs: activeProfile.createdAtUnixMs,
          lastUsedAtUnixMs: activeProfile.lastUsedAtUnixMs,
        }],
      windowBindings: [{
        windowLabel,
        profileId: activeProfile.profileId,
        profileLabel: activeProfile.label,
        launchMode: "existing",
      }],
    };
  } catch {
    return DEFAULT_PROFILE_SNAPSHOT;
  }
};

let currentSnapshot: ProfileIsolationSnapshot = DEFAULT_PROFILE_SNAPSHOT;
const listeners = new Set<Listener>();

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

const setSnapshot = (snapshot: ProfileIsolationSnapshot): void => {
  const previous = currentSnapshot;
  const windowLabel = snapshot.currentWindow.windowLabel || MAIN_WINDOW_LABEL;
  const profileChanged = previous.currentWindow.profileId !== snapshot.currentWindow.profileId
    || previous.currentWindow.profileLabel !== snapshot.currentWindow.profileLabel;
  const profilesChanged = previous.profiles.length !== snapshot.profiles.length
    || previous.windowBindings.length !== snapshot.windowBindings.length;
  currentSnapshot = snapshot;
  setProfileScopeOverride(snapshot.currentWindow.profileId);
  setLastKnownWindowProfileId(windowLabel, snapshot.currentWindow.profileId);
  if (profilesChanged) {
    syncNativeProfilesIntoRegistry(snapshot);
  }
  if (profileChanged || profilesChanged) {
    cryptoService.invalidateCache?.();
  }
  if (profileChanged || profilesChanged) {
    emit();
  }
};

const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = (): ProfileIsolationSnapshot => currentSnapshot;

const invokeProfileCommand = async <T>(
  command: string,
  args?: Record<string, unknown>,
  options?: ProfileCommandOptions
): Promise<T> => {
  const result = await invokeNativeCommand<T>(command, args, {
    timeoutMs: options?.timeoutMs ?? PROFILE_COMMAND_TIMEOUT_MS,
  });
  if (!result.ok) {
    throw new Error(result.message || `Native command ${command} failed.`);
  }
  return result.value;
};

export const applyCachedWindowProfileScope = (windowLabel: string): boolean => {
  const normalizedLabel = windowLabel.trim() || MAIN_WINDOW_LABEL;
  const lastKnownProfileId = getLastKnownWindowProfileId(normalizedLabel);
  if (!lastKnownProfileId) {
    return false;
  }
  const fallback = createFallbackSnapshot(normalizedLabel);
  if (fallback.currentWindow.profileId !== lastKnownProfileId) {
    return false;
  }
  setSnapshot(fallback);
  lastRefreshError = null;
  return true;
};

/** Applies profile scope encoded in a secondary window label before native IPC returns. */
export const applyWindowLabelProfileScope = (windowLabel: string): boolean => {
  const profileId = parseProfileIdFromWindowLabel(windowLabel);
  if (!profileId) {
    return false;
  }
  const normalizedLabel = windowLabel.trim() || MAIN_WINDOW_LABEL;
  setLastKnownWindowProfileId(normalizedLabel, profileId);
  const fallback = createFallbackSnapshot(normalizedLabel);
  if (fallback.currentWindow.profileId !== profileId) {
    return false;
  }
  setSnapshot(fallback);
  lastRefreshError = null;
  return true;
};

/** Applies Tauri init-script payload synchronously before React identity/chat boot. */
export const applyDesktopWindowBootPayload = (): boolean => {
  mirrorDesktopWindowBootPayloadToSyncScope();
  const payload = readDesktopWindowBootPayload();
  if (!payload) {
    return false;
  }
  setLastKnownWindowProfileId(payload.windowLabel, payload.profileId);
  if (applyWindowLabelProfileScope(payload.windowLabel)) {
    lastRefreshError = null;
    return true;
  }
  if (payload.windowLabel === MAIN_WINDOW_LABEL) {
    const fallback = createFallbackSnapshot(MAIN_WINDOW_LABEL);
    setSnapshot({
      ...fallback,
      currentWindow: {
        ...fallback.currentWindow,
        windowLabel: MAIN_WINDOW_LABEL,
        profileId: payload.profileId,
        profileLabel: fallback.currentWindow.profileLabel || payload.profileId,
        launchMode: "existing",
      },
    });
    lastRefreshError = null;
    return true;
  }
  return applyCachedWindowProfileScope(payload.windowLabel);
};

export const resolveNativeWindowLabel = async (): Promise<string> => {
  if (!hasNativeRuntime()) {
    return MAIN_WINDOW_LABEL;
  }
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    return getCurrentWebviewWindow().label.trim() || MAIN_WINDOW_LABEL;
  } catch {
    return MAIN_WINDOW_LABEL;
  }
};

export const desktopProfileRuntime = {
  getSnapshot,
  getLastRefreshError: (): string | null => lastRefreshError,
  subscribe,
  async refresh(): Promise<ProfileIsolationSnapshot> {
    if (!hasNativeRuntime()) {
      const fallback = createFallbackSnapshot(MAIN_WINDOW_LABEL);
      setSnapshot(fallback);
      lastRefreshError = null;
      return fallback;
    }

    if (refreshInFlightPromise) {
      return refreshInFlightPromise;
    }

    refreshInFlightPromise = (async (): Promise<ProfileIsolationSnapshot> => {
      const startedAtUnixMs = Date.now();
      try {
        const snapshot = await invokeProfileCommand<ProfileIsolationSnapshot>(
          "desktop_get_profile_isolation_snapshot",
          undefined,
          { timeoutMs: PROFILE_SNAPSHOT_TIMEOUT_MS }
        );
        setSnapshot(snapshot);
        lastRefreshError = null;
        logAppEvent({
          name: "runtime.profile_binding_refresh_completed",
          level: "debug",
          scope: { feature: "runtime", action: "profile_boot" },
          context: {
            profileId: snapshot.currentWindow.profileId,
            elapsedMs: Math.max(0, Date.now() - startedAtUnixMs),
          },
        });
        return snapshot;
      } catch (error) {
        lastRefreshError = error instanceof Error ? error.message : String(error);
        const fallback = createFallbackSnapshot(currentSnapshot.currentWindow.windowLabel || MAIN_WINDOW_LABEL);
        setSnapshot(fallback);
        return fallback;
      } finally {
        refreshInFlightPromise = null;
      }
    })();

    return refreshInFlightPromise;
  },
  async listProfiles(): Promise<ReadonlyArray<ProfileSummary>> {
    if (!hasNativeRuntime()) {
      return getSnapshot().profiles;
    }
    return invokeProfileCommand<ReadonlyArray<ProfileSummary>>("desktop_list_profiles");
  },
  async createProfile(label: string): Promise<ProfileIsolationSnapshot> {
    const snapshot = await invokeProfileCommand<ProfileIsolationSnapshot>("desktop_create_profile", { label });
    setSnapshot(snapshot);
    return snapshot;
  },
  async renameProfile(profileId: ProfileId, label: string): Promise<ProfileIsolationSnapshot> {
    const snapshot = await invokeProfileCommand<ProfileIsolationSnapshot>("desktop_rename_profile", { profileId, label });
    setSnapshot(snapshot);
    return snapshot;
  },
  async bindCurrentWindowProfile(profileId: ProfileId): Promise<ProfileIsolationSnapshot> {
    const snapshot = await invokeProfileCommand<ProfileIsolationSnapshot>("desktop_bind_window_profile", { profileId });
    setSnapshot(snapshot);
    return snapshot;
  },
  async openProfileWindow(profileId: ProfileId): Promise<void> {
    await invokeProfileCommand("desktop_open_profile_window", { profileId });
  },
  async removeProfile(profileId: ProfileId): Promise<ProfileIsolationSnapshot> {
    const snapshot = await invokeProfileCommand<ProfileIsolationSnapshot>("desktop_remove_profile", { profileId });
    setSnapshot(snapshot);
    return snapshot;
  },
};

export const useDesktopProfileIsolationSnapshot = (): ProfileIsolationSnapshot => (
  useSyncExternalStore(desktopProfileRuntime.subscribe, desktopProfileRuntime.getSnapshot, desktopProfileRuntime.getSnapshot)
);
