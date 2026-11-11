/**
 * Cut 14.1 — Vite Settings residue (Continuity T2 slots).
 * Local only · ≠ Soft L3 invent · ≠ Continuity Pass · ≠ live mesh.
 * @see specs/backend/cut14-vite-settings-narrow-design-2026-11-10.md
 */

import type { ContinuityM1RelayEntry } from "../continuity/continuity-m1-snapshot";

export const VITE_SETTINGS_RESIDUE_STORAGE_PREFIX = "obscur.vite.settings.v1";

export type ViteSettingsResidue = Readonly<{
  displayName: string;
  relayList: ReadonlyArray<ContinuityM1RelayEntry>;
  privacySettings: Readonly<Record<string, unknown>>;
  uiSettings: Readonly<Record<string, unknown>>;
}>;

export const EMPTY_VITE_SETTINGS_RESIDUE: ViteSettingsResidue = Object.freeze({
  displayName: "",
  relayList: Object.freeze([]),
  privacySettings: Object.freeze({}),
  uiSettings: Object.freeze({}),
});

export const getViteSettingsResidueStorageKey = (profileId: string): string => (
  `${VITE_SETTINGS_RESIDUE_STORAGE_PREFIX}::${profileId}`
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const parseRelayEntry = (value: unknown): ContinuityM1RelayEntry | null => {
  if (!isRecord(value) || typeof value.url !== "string") {
    return null;
  }
  const url = value.url.trim();
  if (!url) {
    return null;
  }
  return {
    url,
    enabled: value.enabled !== false,
  };
};

export const parseViteSettingsResidue = (value: unknown): ViteSettingsResidue => {
  if (!isRecord(value)) {
    return EMPTY_VITE_SETTINGS_RESIDUE;
  }
  const relayList = Array.isArray(value.relayList)
    ? value.relayList.map(parseRelayEntry).filter((row): row is ContinuityM1RelayEntry => row !== null)
    : [];
  return {
    displayName: typeof value.displayName === "string" ? value.displayName : "",
    relayList,
    privacySettings: isRecord(value.privacySettings) ? { ...value.privacySettings } : {},
    uiSettings: isRecord(value.uiSettings) ? { ...value.uiSettings } : {},
  };
};

export const readViteSettingsResidue = (profileId: string): ViteSettingsResidue => {
  if (typeof window === "undefined") {
    return EMPTY_VITE_SETTINGS_RESIDUE;
  }
  const raw = window.localStorage.getItem(getViteSettingsResidueStorageKey(profileId));
  if (!raw) {
    return EMPTY_VITE_SETTINGS_RESIDUE;
  }
  try {
    return parseViteSettingsResidue(JSON.parse(raw));
  } catch {
    return EMPTY_VITE_SETTINGS_RESIDUE;
  }
};

export const writeViteSettingsResidue = (
  profileId: string,
  residue: ViteSettingsResidue,
): ViteSettingsResidue => {
  const next: ViteSettingsResidue = {
    displayName: residue.displayName.trim(),
    relayList: residue.relayList.map((row) => ({
      url: row.url.trim(),
      enabled: row.enabled !== false,
    })).filter((row) => row.url.length > 0),
    privacySettings: { ...residue.privacySettings },
    uiSettings: { ...residue.uiSettings },
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      getViteSettingsResidueStorageKey(profileId),
      JSON.stringify(next),
    );
  }
  return next;
};

export const upsertViteSettingsRelay = (
  profileId: string,
  entry: ContinuityM1RelayEntry,
): ViteSettingsResidue => {
  const current = readViteSettingsResidue(profileId);
  const url = entry.url.trim();
  const without = current.relayList.filter((row) => row.url !== url);
  return writeViteSettingsResidue(profileId, {
    ...current,
    relayList: [...without, { url, enabled: entry.enabled !== false }],
  });
};

export const removeViteSettingsRelay = (
  profileId: string,
  url: string,
): ViteSettingsResidue => {
  const current = readViteSettingsResidue(profileId);
  return writeViteSettingsResidue(profileId, {
    ...current,
    relayList: current.relayList.filter((row) => row.url !== url.trim()),
  });
};
