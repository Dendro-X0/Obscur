import { getDefaultProfileId } from "./profile-scope";
import { readDesktopWindowBootPayload } from "./desktop-window-boot-payload";
import { getResolvedProfileId } from "./profile-runtime-scope";
import { resolveDesktopWindowProfileScope } from "./resolve-desktop-window-profile-scope";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

type WindowWithSyncProfileScope = Window & {
  __OBSCUR_SYNC_PROFILE_SCOPE__?: string;
};

const readSyncInjectedProfileScope = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const syncScope = (window as WindowWithSyncProfileScope).__OBSCUR_SYNC_PROFILE_SCOPE__;
  return syncScope && syncScope.trim().length > 0 ? syncScope.trim() : null;
};

const readWindowLabelScopedProfileId = (): string | null => {
  const bootPayload = readDesktopWindowBootPayload();
  if (!bootPayload?.windowLabel || !bootPayload.profileId) {
    return null;
  }
  if (typeof window === "undefined") {
    return bootPayload.profileId;
  }
  try {
    const cached = window.localStorage.getItem(
      `obscur.desktop.window_profile.last_known.v1::${bootPayload.windowLabel}`,
    );
    return resolveDesktopWindowProfileScope(cached, bootPayload.profileId);
  } catch {
    return bootPayload.profileId;
  }
};

/**
 * Resolves the profile id for this desktop window before React profile runtime hydrates.
 * Order: Tauri init sync scope → boot payload cache → legacy global last-known → registry default.
 */
export const readActiveDesktopProfileId = (): string => {
  const syncScope = readSyncInjectedProfileScope();
  if (syncScope) {
    return syncScope;
  }

  const windowScopedProfileId = readWindowLabelScopedProfileId();
  if (windowScopedProfileId) {
    return windowScopedProfileId;
  }

  if (typeof window === "undefined") {
    return getDefaultProfileId();
  }

  try {
    const legacyLastKnown = window.localStorage.getItem(
      "obscur.desktop.window_profile.last_known.v1",
    )?.trim();
    if (legacyLastKnown) {
      return legacyLastKnown;
    }
    const registryRaw = window.localStorage.getItem("obscur.profiles.registry.v1");
    if (registryRaw) {
      const registry = JSON.parse(registryRaw) as { activeProfileId?: unknown };
      if (typeof registry.activeProfileId === "string" && registry.activeProfileId.trim().length > 0) {
        return registry.activeProfileId.trim();
      }
    }
  } catch {
    // fall through
  }

  return getDefaultProfileId();
};

/**
 * Profile id for identity/session storage on this client.
 * Desktop multi-window: window binding wins over registry active profile.
 */
export const resolveIdentityScopeProfileId = (): string => (
  hasNativeRuntime() ? readActiveDesktopProfileId() : getResolvedProfileId()
);
