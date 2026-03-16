import type { AdapterResult } from "@/app/features/runtime/adapter-result";
import { failedResult, okResult } from "@/app/features/runtime/adapter-result";

export type ProfileStatus = "active" | "inactive";

export type ProfileRecord = Readonly<{
  profileId: string;
  label: string;
  createdAtUnixMs: number;
  lastUsedAtUnixMs: number;
  status: ProfileStatus;
}>;

export type ActiveProfileState = Readonly<{
  activeProfileId: string;
  profiles: ReadonlyArray<ProfileRecord>;
}>;

export type ProfileSwitchResult = AdapterResult<ActiveProfileState>;

const STORAGE_KEY = "obscur.profiles.registry.v1";
const DEFAULT_PROFILE_ID = "default";
const DEFAULT_LABEL = "Default";
export const PROFILE_CHANGED_EVENT = "obscur-profile-changed";

type PersistedRegistry = Readonly<{
  version: 1;
  activeProfileId: string;
  profiles: ProfileRecord[];
}>;

const now = (): number => Date.now();

const createDefaultState = (): ActiveProfileState => {
  const createdAt = now();
  return {
    activeProfileId: DEFAULT_PROFILE_ID,
    profiles: [
      {
        profileId: DEFAULT_PROFILE_ID,
        label: DEFAULT_LABEL,
        createdAtUnixMs: createdAt,
        lastUsedAtUnixMs: createdAt,
        status: "active",
      },
    ],
  };
};

const normalize = (state: ActiveProfileState): ActiveProfileState => {
  const hasActive = state.profiles.some((p) => p.profileId === state.activeProfileId);
  const activeId = hasActive ? state.activeProfileId : (state.profiles[0]?.profileId ?? DEFAULT_PROFILE_ID);
  const profiles = state.profiles.map((p) => ({
    ...p,
    status: (p.profileId === activeId ? "active" : "inactive") as ProfileStatus,
  }));
  if (profiles.length === 0) return createDefaultState();
  return { activeProfileId: activeId, profiles };
};

const load = (): ActiveProfileState => {
  if (typeof window === "undefined") return createDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as PersistedRegistry;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.profiles) || typeof parsed.activeProfileId !== "string") {
      return createDefaultState();
    }
    return normalize({
      activeProfileId: parsed.activeProfileId,
      profiles: parsed.profiles,
    });
  } catch {
    return createDefaultState();
  }
};

const persist = (state: ActiveProfileState): void => {
  if (typeof window === "undefined") return;
  const payload: PersistedRegistry = {
    version: 1,
    activeProfileId: state.activeProfileId,
    profiles: [...state.profiles],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

let cachedState: ActiveProfileState | null = null;

const getState = (): ActiveProfileState => {
  if (!cachedState) {
    cachedState = load();
    persist(cachedState);
  }
  return cachedState;
};

const setState = (next: ActiveProfileState): ActiveProfileState => {
  cachedState = normalize(next);
  persist(cachedState);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PROFILE_CHANGED_EVENT, { detail: cachedState })
    );
  }
  return cachedState;
};

const safeProfileId = (input: string): string => {
  const normalized = input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  return normalized || `profile-${now()}`;
};

export class ProfileRegistryService {
  static getState(): ActiveProfileState {
    return getState();
  }

  static getActiveProfileId(): string {
    return getState().activeProfileId;
  }

  static replaceState(next: ActiveProfileState): ActiveProfileState {
    return setState(next);
  }

  static createProfile(label: string): ProfileSwitchResult {
    try {
      const state = getState();
      const baseProfileId = safeProfileId(label);
      let profileId = baseProfileId;
      let suffix = 1;
      while (state.profiles.some((p) => p.profileId === profileId)) {
        profileId = `${baseProfileId}-${suffix}`;
        suffix += 1;
      }
      const created: ProfileRecord = {
        profileId,
        label: label.trim() || "Profile",
        createdAtUnixMs: now(),
        lastUsedAtUnixMs: now(),
        status: "inactive",
      };
      const next = setState({
        ...state,
        profiles: [...state.profiles, created],
      });
      return okResult(next);
    } catch (error) {
      return failedResult(error instanceof Error ? error.message : String(error));
    }
  }

  static ensureProfile(profileId: string, label?: string): ProfileSwitchResult {
    try {
      const state = getState();
      const existing = state.profiles.find((profile) => profile.profileId === profileId);
      if (existing) {
        const next = setState({
          ...state,
          profiles: state.profiles.map((profile) =>
            profile.profileId === profileId && label?.trim()
              ? { ...profile, label: label.trim() }
              : profile
          ),
        });
        return okResult(next);
      }

      const createdAt = now();
      const next = setState({
        ...state,
        profiles: [
          ...state.profiles,
          {
            profileId: safeProfileId(profileId),
            label: label?.trim() || "Profile",
            createdAtUnixMs: createdAt,
            lastUsedAtUnixMs: createdAt,
            status: "inactive",
          },
        ],
      });
      return okResult(next);
    } catch (error) {
      return failedResult(error instanceof Error ? error.message : String(error));
    }
  }

  static renameProfile(profileId: string, label: string): ProfileSwitchResult {
    try {
      const state = getState();
      const nextProfiles = state.profiles.map((profile) =>
        profile.profileId === profileId ? { ...profile, label: label.trim() || profile.label } : profile
      );
      const next = setState({ ...state, profiles: nextProfiles });
      return okResult(next);
    } catch (error) {
      return failedResult(error instanceof Error ? error.message : String(error));
    }
  }

  static switchProfile(profileId: string): ProfileSwitchResult {
    try {
      const state = getState();
      if (!state.profiles.some((profile) => profile.profileId === profileId)) {
        return failedResult("Profile not found.");
      }
      const next = setState({
        activeProfileId: profileId,
        profiles: state.profiles.map((profile) =>
          profile.profileId === profileId
            ? { ...profile, lastUsedAtUnixMs: now() }
            : profile
        ),
      });
      return okResult(next);
    } catch (error) {
      return failedResult(error instanceof Error ? error.message : String(error));
    }
  }

  static removeProfile(profileId: string): ProfileSwitchResult {
    try {
      const state = getState();
      if (profileId === DEFAULT_PROFILE_ID) {
        return failedResult("Default profile cannot be removed.");
      }
      const nextProfiles = state.profiles.filter((p) => p.profileId !== profileId);
      const fallbackActiveId =
        state.activeProfileId === profileId ? (nextProfiles[0]?.profileId ?? DEFAULT_PROFILE_ID) : state.activeProfileId;
      const next = setState({
        activeProfileId: fallbackActiveId,
        profiles: nextProfiles,
      });
      return okResult(next);
    } catch (error) {
      return failedResult(error instanceof Error ? error.message : String(error));
    }
  }
}

export const profileRegistryServiceInternals = {
  resetForTests: (): void => {
    cachedState = null;
  },
};
