"use client";

import { useSyncExternalStore } from "react";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { ProfileRegistryService } from "./profile-registry-service";
import { cryptoService } from "@/app/features/crypto/crypto-service";
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

let refreshInFlightPromise: Promise<ProfileIsolationSnapshot> | null = null;
let lastRefreshError: string | null = null;

const getLastKnownWindowProfileId = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(LAST_KNOWN_WINDOW_PROFILE_ID_STORAGE_KEY);
    return raw && raw.trim().length > 0 ? raw.trim() : null;
  } catch {
    return null;
  }
};

const setLastKnownWindowProfileId = (profileId: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(LAST_KNOWN_WINDOW_PROFILE_ID_STORAGE_KEY, profileId);
  } catch {
    // Best-effort only.
  }
};

const createFallbackSnapshot = (windowLabel = MAIN_WINDOW_LABEL): ProfileIsolationSnapshot => {
  try {
    const registryState = ProfileRegistryService.getState();
    const lastKnownProfileId = getLastKnownWindowProfileId();
    const activeProfileId = lastKnownProfileId ?? registryState.activeProfileId;
    const activeProfile = registryState.profiles.find((profile) => profile.profileId === activeProfileId)
      ?? registryState.profiles.find((profile) => profile.profileId === registryState.activeProfileId)
      ?? registryState.profiles[0];

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
      profiles: registryState.profiles.map((profile) => ({
        profileId: profile.profileId,
        label: profile.label,
        createdAtUnixMs: profile.createdAtUnixMs,
        lastUsedAtUnixMs: profile.lastUsedAtUnixMs,
      })),
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

let currentSnapshot: ProfileIsolationSnapshot = createFallbackSnapshot();
setProfileScopeOverride(currentSnapshot.currentWindow.profileId);
setLastKnownWindowProfileId(currentSnapshot.currentWindow.profileId);
const listeners = new Set<Listener>();

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

const setSnapshot = (snapshot: ProfileIsolationSnapshot): void => {
  const changed = JSON.stringify(currentSnapshot) !== JSON.stringify(snapshot);
  currentSnapshot = snapshot;
  setProfileScopeOverride(snapshot.currentWindow.profileId);
  setLastKnownWindowProfileId(snapshot.currentWindow.profileId);
  cryptoService.invalidateCache?.();
  ProfileRegistryService.replaceState({
    activeProfileId: snapshot.currentWindow.profileId,
    profiles: snapshot.profiles.map((profile) => ({
      ...profile,
      status: profile.profileId === snapshot.currentWindow.profileId ? "active" : "inactive",
    })),
  });
  if (changed) {
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
      try {
        const snapshot = await invokeProfileCommand<ProfileIsolationSnapshot>(
          "desktop_get_profile_isolation_snapshot",
          undefined,
          { timeoutMs: PROFILE_SNAPSHOT_TIMEOUT_MS }
        );
        setSnapshot(snapshot);
        lastRefreshError = null;
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
