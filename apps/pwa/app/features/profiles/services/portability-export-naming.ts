import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

export type PortabilityExportNamingPreset =
  | "pubkey_prefix_date"
  | "profile_label_date"
  | "timestamp_only";

export const PORTABILITY_EXPORT_NAMING_PRESETS: ReadonlyArray<Readonly<{
  id: PortabilityExportNamingPreset;
  label: string;
  description: string;
}>> = [
  {
    id: "profile_label_date",
    label: "Profile name + date (recommended)",
    description: "{profileLabel}-account-export-{date}.obscur-account-export.json",
  },
  {
    id: "pubkey_prefix_date",
    label: "Account prefix + date",
    description: "obscur-account-export-{pubkey8}-{date}.obscur-account-export.json",
  },
  {
    id: "timestamp_only",
    label: "Timestamp only",
    description: "obscur-export-{timestamp}.obscur-account-export.json",
  },
];

const STORAGE_KEY = "obscur.portability.export_naming_preset";

const sanitizeLabel = (value: string | undefined): string => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "profile";
  }
  return trimmed
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "profile";
};

const formatExportTimestamp = (exportedAtUnixMs: number): string => {
  const date = new Date(exportedAtUnixMs);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
};

export const resolvePortabilityExportNamingPreset = (params?: Readonly<{
  profileLabel?: string;
  profileId?: string;
}>): PortabilityExportNamingPreset => {
  const stored = typeof window !== "undefined"
    ? window.localStorage.getItem(getScopedStorageKey(STORAGE_KEY, params?.profileId ?? getResolvedProfileId()))
    : null;
  if (stored === "profile_label_date" || stored === "timestamp_only" || stored === "pubkey_prefix_date") {
    return stored;
  }
  return params?.profileLabel?.trim() ? "profile_label_date" : "pubkey_prefix_date";
};

export const loadPortabilityExportNamingPreset = (profileId?: string): PortabilityExportNamingPreset => (
  resolvePortabilityExportNamingPreset({ profileId })
);

export const savePortabilityExportNamingPreset = (
  preset: PortabilityExportNamingPreset,
  profileId?: string,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    getScopedStorageKey(STORAGE_KEY, profileId ?? getResolvedProfileId()),
    preset,
  );
};

export const buildPortableAccountExportFileName = (params: Readonly<{
  publicKeyHex: string;
  profileLabel?: string;
  exportedAtUnixMs: number;
  preset?: PortabilityExportNamingPreset;
}>): string => {
  const preset = params.preset ?? resolvePortabilityExportNamingPreset({
    profileLabel: params.profileLabel,
  });
  const dateToken = formatExportTimestamp(params.exportedAtUnixMs);
  if (preset === "timestamp_only") {
    return `obscur-export-${params.exportedAtUnixMs}.json`;
  }
  if (preset === "profile_label_date") {
    return `${sanitizeLabel(params.profileLabel)}-portable-${dateToken}.json`;
  }
  return `obscur-portable-account-${params.publicKeyHex.slice(0, 8)}-${dateToken}.json`;
};

export const buildUnifiedAccountExportFileName = (params: Readonly<{
  publicKeyHex: string;
  profileLabel?: string;
  exportedAtUnixMs: number;
  preset?: PortabilityExportNamingPreset;
}>): string => {
  const preset = params.preset ?? resolvePortabilityExportNamingPreset({
    profileLabel: params.profileLabel,
  });
  const dateToken = formatExportTimestamp(params.exportedAtUnixMs);
  if (preset === "timestamp_only") {
    return `obscur-export-${params.exportedAtUnixMs}.obscur-account-export.json`;
  }
  if (preset === "profile_label_date") {
    return `${sanitizeLabel(params.profileLabel)}-account-export-${dateToken}.obscur-account-export.json`;
  }
  return `obscur-account-export-${params.publicKeyHex.slice(0, 8)}-${dateToken}.obscur-account-export.json`;
};

export const buildUnifiedAccountExportFileNamePreview = (params: Readonly<{
  publicKeyHex: string;
  profileLabel?: string;
  exportedAtUnixMs?: number;
  preset?: PortabilityExportNamingPreset;
}>): string => (
  buildUnifiedAccountExportFileName({
    publicKeyHex: params.publicKeyHex,
    profileLabel: params.profileLabel,
    exportedAtUnixMs: params.exportedAtUnixMs ?? Date.now(),
    preset: params.preset,
  })
);

export const buildWorkspaceBundleExportFileName = (params: Readonly<{
  profileId: string;
  profileLabel?: string;
  exportedAtUnixMs: number;
  preset?: PortabilityExportNamingPreset;
}>): string => {
  const preset = params.preset ?? "profile_label_date";
  const dateToken = formatExportTimestamp(params.exportedAtUnixMs);
  if (preset === "timestamp_only") {
    return `obscur-export-${params.exportedAtUnixMs}.obscur-bundle`;
  }
  if (preset === "profile_label_date") {
    return `${sanitizeLabel(params.profileLabel ?? params.profileId)}-workspace-${dateToken}.obscur-bundle`;
  }
  return `${params.profileId}__workspace__${dateToken}.obscur-bundle`;
};
