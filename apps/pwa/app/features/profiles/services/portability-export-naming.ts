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
    id: "pubkey_prefix_date",
    label: "Account prefix + date",
    description: "obscur-portable-account-{pubkey8}-{date}.json",
  },
  {
    id: "profile_label_date",
    label: "Profile label + date",
    description: "{profileLabel}-workspace-{date}.obscur-bundle",
  },
  {
    id: "timestamp_only",
    label: "Timestamp only",
    description: "obscur-export-{timestamp}.{ext}",
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

const formatExportTimestamp = (exportedAtUnixMs: number): string => (
  new Date(exportedAtUnixMs).toISOString().replace(/[:.]/g, "-")
);

export const loadPortabilityExportNamingPreset = (profileId?: string): PortabilityExportNamingPreset => {
  if (typeof window === "undefined") {
    return "pubkey_prefix_date";
  }
  const raw = window.localStorage.getItem(getScopedStorageKey(STORAGE_KEY, profileId ?? getResolvedProfileId()));
  if (raw === "profile_label_date" || raw === "timestamp_only" || raw === "pubkey_prefix_date") {
    return raw;
  }
  return "pubkey_prefix_date";
};

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
  const preset = params.preset ?? "pubkey_prefix_date";
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
  const preset = params.preset ?? "pubkey_prefix_date";
  const dateToken = formatExportTimestamp(params.exportedAtUnixMs);
  if (preset === "timestamp_only") {
    return `obscur-export-${params.exportedAtUnixMs}.obscur-account-export.json`;
  }
  if (preset === "profile_label_date") {
    return `${sanitizeLabel(params.profileLabel)}-account-export-${dateToken}.obscur-account-export.json`;
  }
  return `obscur-account-export-${params.publicKeyHex.slice(0, 8)}-${dateToken}.obscur-account-export.json`;
};

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
