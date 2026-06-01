import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

export type PortabilityExportKind = "portable_account" | "workspace_bundle" | "unified_account";

export type PortabilityExportHistoryEntry = Readonly<{
  id: string;
  kind: PortabilityExportKind;
  fileName: string;
  absolutePath: string | null;
  exportedAtUnixMs: number;
  estimatedSizeBytes: number;
  label: string;
}>;

const STORAGE_KEY = "obscur.portability.export_history";
const MAX_ENTRIES = 8;

const readHistory = (profileId: string): PortabilityExportHistoryEntry[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(getScopedStorageKey(STORAGE_KEY, profileId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry): entry is PortabilityExportHistoryEntry => (
      typeof entry === "object"
      && entry !== null
      && typeof entry.id === "string"
      && (entry.kind === "portable_account" || entry.kind === "workspace_bundle" || entry.kind === "unified_account")
      && typeof entry.fileName === "string"
      && typeof entry.exportedAtUnixMs === "number"
      && typeof entry.label === "string"
    ));
  } catch {
    return [];
  }
};

const writeHistory = (profileId: string, entries: PortabilityExportHistoryEntry[]): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(getScopedStorageKey(STORAGE_KEY, profileId), JSON.stringify(entries));
};

export const recordPortabilityExport = (
  entry: Omit<PortabilityExportHistoryEntry, "id"> & Readonly<{ id?: string }>,
  profileId?: string,
): PortabilityExportHistoryEntry => {
  const resolvedProfileId = profileId ?? getResolvedProfileId();
  const nextEntry: PortabilityExportHistoryEntry = {
    ...entry,
    id: entry.id ?? `${entry.kind}-${entry.exportedAtUnixMs}`,
  };
  const history = readHistory(resolvedProfileId);
  writeHistory(resolvedProfileId, [nextEntry, ...history.filter((item) => item.id !== nextEntry.id)].slice(0, MAX_ENTRIES));
  return nextEntry;
};

export const getPortabilityExportHistory = (
  profileId?: string,
): ReadonlyArray<PortabilityExportHistoryEntry> => readHistory(profileId ?? getResolvedProfileId());

export const getLatestPortabilityExport = (
  kind?: PortabilityExportKind,
  profileId?: string,
): PortabilityExportHistoryEntry | null => {
  const history = getPortabilityExportHistory(profileId);
  if (kind) {
    return history.find((entry) => entry.kind === kind) ?? null;
  }
  return history[0] ?? null;
};
