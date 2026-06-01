import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

const EXTRA_SCAN_ROOTS_STORAGE_KEY = "obscur.save_library.extra_scan_roots.v1";

export type SaveLibraryContext = Readonly<{
  dataRootPath: string;
  exportsFolderPath: string;
  profileArchivesFolderPath: string;
  scanRoots: ReadonlyArray<string>;
}>;

export const loadExtraSaveLibraryScanRoots = (): ReadonlyArray<string> => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(EXTRA_SCAN_ROOTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  } catch {
    return [];
  }
};

export const saveExtraSaveLibraryScanRoots = (roots: ReadonlyArray<string>): void => {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = Array.from(new Set(
    roots.map((root) => root.trim()).filter((root) => root.length > 0),
  ));
  window.localStorage.setItem(EXTRA_SCAN_ROOTS_STORAGE_KEY, JSON.stringify(normalized));
};

export const addExtraSaveLibraryScanRoot = (root: string): ReadonlyArray<string> => {
  const trimmed = root.trim();
  if (!trimmed) {
    return loadExtraSaveLibraryScanRoots();
  }
  const next = Array.from(new Set([...loadExtraSaveLibraryScanRoots(), trimmed]));
  saveExtraSaveLibraryScanRoots(next);
  return next;
};

const normalizeSaveLibraryContext = (raw: Record<string, unknown>): SaveLibraryContext | null => {
  const dataRootPath = typeof raw.dataRootPath === "string"
    ? raw.dataRootPath
    : typeof raw.data_root_path === "string"
      ? raw.data_root_path
      : "";
  const exportsFolderPath = typeof raw.exportsFolderPath === "string"
    ? raw.exportsFolderPath
    : typeof raw.exports_folder_path === "string"
      ? raw.exports_folder_path
      : "";
  const profileArchivesFolderPath = typeof raw.profileArchivesFolderPath === "string"
    ? raw.profileArchivesFolderPath
    : typeof raw.profile_archives_folder_path === "string"
      ? raw.profile_archives_folder_path
      : "";
  const scanRootsRaw = Array.isArray(raw.scanRoots)
    ? raw.scanRoots
    : Array.isArray(raw.scan_roots)
      ? raw.scan_roots
      : [];
  const scanRoots = scanRootsRaw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (!dataRootPath.trim() || scanRoots.length === 0) {
    return null;
  }
  return {
    dataRootPath: dataRootPath.trim(),
    exportsFolderPath: exportsFolderPath.trim(),
    profileArchivesFolderPath: profileArchivesFolderPath.trim(),
    scanRoots,
  };
};

export const getSaveLibraryContext = async (): Promise<SaveLibraryContext | null> => {
  if (!hasNativeRuntime()) {
    return null;
  }
  const result = await invokeNativeCommand<SaveLibraryContext>("desktop_get_save_library_context");
  if (!result.ok || !result.value) {
    return null;
  }
  return normalizeSaveLibraryContext(result.value as unknown as Record<string, unknown>);
};

export const buildDefaultSaveLibraryScanRoots = async (): Promise<ReadonlyArray<string>> => {
  const context = await getSaveLibraryContext();
  const roots = context?.scanRoots ? [...context.scanRoots] : [];
  loadExtraSaveLibraryScanRoots().forEach((root) => roots.push(root));
  return Array.from(new Set(roots.map((root) => root.trim()).filter((root) => root.length > 0)));
};
