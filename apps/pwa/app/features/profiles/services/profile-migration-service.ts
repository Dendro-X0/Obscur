import { identityStoreName } from "@/app/features/auth/utils/identity-store-name";
import { openIdentityDb } from "@/app/features/auth/utils/open-identity-db";
import { defaultPrivacySettings } from "@/app/features/settings/services/privacy-settings-service";
import type { ProfileMigrationReport } from "./profile-scope";
import {
  getDefaultProfileId,
  getDefaultProfileIdentityDbKey,
  getDefaultScopedStorageKey,
} from "./profile-scope";

const MIGRATION_MARKER_KEY = "obscur.migration.v088.profile.done";
const SNAPSHOT_PREFIX = "obscur.migration.v088.snapshot";
const LEGACY_IDENTITY_KEY = "primary";
const LEGACY_PRIVACY_KEY = "obscur.settings.privacy";
const LEGACY_PROFILE_KEY = "dweb.nostr.pwa.profile";

const createEmptyReport = (): ProfileMigrationReport => ({
  backupCreated: false,
  migratedIdentity: false,
  migratedPrivacy: false,
  migratedProfile: false,
  skipped: 0,
  conflicted: 0,
  errors: 0,
  activeProfileId: getDefaultProfileId(),
});

const parseJson = (value: string | null): unknown => {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const createSnapshot = (): string | undefined => {
  if (typeof window === "undefined") return undefined;
  const timestamp = Date.now();
  const snapshotKey = `${SNAPSHOT_PREFIX}.${timestamp}`;
  const snapshot = {
    takenAtUnixMs: timestamp,
    localStorage: {
      [LEGACY_PRIVACY_KEY]: parseJson(window.localStorage.getItem(LEGACY_PRIVACY_KEY)),
      [LEGACY_PROFILE_KEY]: parseJson(window.localStorage.getItem(LEGACY_PROFILE_KEY)),
    },
  };

  try {
    window.localStorage.setItem(snapshotKey, JSON.stringify(snapshot));
    return snapshotKey;
  } catch {
    return undefined;
  }
};

const migrateLocalStorageKey = (
  report: ProfileMigrationReport,
  baseKey: string,
  legacyKey: string
): ProfileMigrationReport => {
  if (typeof window === "undefined") return report;

  const scopedKey = getDefaultScopedStorageKey(baseKey);
  const scopedExists = window.localStorage.getItem(scopedKey) !== null;
  const legacyRaw = window.localStorage.getItem(legacyKey);
  if (legacyRaw == null) {
    return { ...report, skipped: report.skipped + 1 };
  }

  if (scopedExists) {
    return { ...report, conflicted: report.conflicted + 1 };
  }

  window.localStorage.setItem(scopedKey, legacyRaw);
  return report;
};

const migrateIdentityStore = async (report: ProfileMigrationReport): Promise<ProfileMigrationReport> => {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return { ...report, skipped: report.skipped + 1 };
  }

  try {
    const db = await openIdentityDb();
    const targetKey = getDefaultProfileIdentityDbKey();
    const readValue = async (key: string): Promise<unknown> => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(identityStoreName, "readonly");
        const store = tx.objectStore(identityStoreName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error(`Failed to read identity key: ${key}`));
      });
    };

    const writeValue = async (key: string, value: unknown): Promise<void> => {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(identityStoreName, "readwrite");
        const store = tx.objectStore(identityStoreName);
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error(`Failed to write identity key: ${key}`));
      });
    };

    const legacyValue = await readValue(LEGACY_IDENTITY_KEY);
    if (legacyValue == null) {
      return { ...report, skipped: report.skipped + 1 };
    }

    const targetValue = await readValue(targetKey);
    if (targetValue != null) {
      return { ...report, conflicted: report.conflicted + 1 };
    }

    await writeValue(targetKey, legacyValue);
    return { ...report, migratedIdentity: true };
  } catch {
    return { ...report, errors: report.errors + 1 };
  }
};

export const runProfileMigrationV088 = async (): Promise<ProfileMigrationReport> => {
  if (typeof window === "undefined") return createEmptyReport();
  if (window.localStorage.getItem(MIGRATION_MARKER_KEY) === "1") {
    return createEmptyReport();
  }

  let report = createEmptyReport();

  const snapshotKey = createSnapshot();
  if (snapshotKey) {
    report = { ...report, backupCreated: true, snapshotKey };
  }

  try {
    // Migrate privacy settings.
    report = migrateLocalStorageKey(report, "obscur.settings.privacy", LEGACY_PRIVACY_KEY);
    const privacyScopedKey = getDefaultScopedStorageKey("obscur.settings.privacy");
    const privacyParsed = parseJson(window.localStorage.getItem(privacyScopedKey));
    if (privacyParsed && typeof privacyParsed === "object") {
      report = { ...report, migratedPrivacy: true };
    } else {
      window.localStorage.setItem(privacyScopedKey, JSON.stringify(defaultPrivacySettings));
      report = { ...report, migratedPrivacy: true };
    }

    // Migrate local profile draft settings.
    report = migrateLocalStorageKey(report, "dweb.nostr.pwa.profile", LEGACY_PROFILE_KEY);
    if (window.localStorage.getItem(getDefaultScopedStorageKey("dweb.nostr.pwa.profile")) != null) {
      report = { ...report, migratedProfile: true };
    }

    // Migrate identity store key.
    report = await migrateIdentityStore(report);

    window.localStorage.setItem(MIGRATION_MARKER_KEY, "1");
    window.localStorage.setItem("obscur.migration.v088.profile.report", JSON.stringify(report));
    return report;
  } catch {
    const failed = { ...report, errors: report.errors + 1 };
    window.localStorage.setItem("obscur.migration.v088.profile.report", JSON.stringify(failed));
    return failed;
  }
};

export const hasProfileMigrationRunV088 = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MIGRATION_MARKER_KEY) === "1";
};

export const getProfileMigrationReportV088 = (): ProfileMigrationReport | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("obscur.migration.v088.profile.report");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ProfileMigrationReport;
  } catch {
    return null;
  }
};
