import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { buildDefaultSaveLibraryScanRoots } from "./local-save-scan-roots";
import type { LocalSaveLibraryEntry, LocalSaveLibraryScanResult } from "./local-save-contracts";
import { parseObscurLocalSaveSidecar } from "./local-save-sidecar";

const SCAN_CACHE_STORAGE_KEY = "obscur.save_library.scan_cache.v1";
const SCAN_CACHE_MAX_AGE_MS = 30_000;

let scanInFlight: Promise<LocalSaveLibraryScanResult> | null = null;

type ScanCacheRecord = Readonly<{
  scannedAtUnixMs: number;
  rootsKey: string;
  result: LocalSaveLibraryScanResult;
}>;

const readStringField = (raw: Record<string, unknown>, camel: string, snake: string): string | null => {
  const camelValue = raw[camel];
  if (typeof camelValue === "string") {
    return camelValue;
  }
  const snakeValue = raw[snake];
  return typeof snakeValue === "string" ? snakeValue : null;
};

const readNumberField = (raw: Record<string, unknown>, camel: string, snake: string): number | undefined => {
  const camelValue = raw[camel];
  if (typeof camelValue === "number") {
    return camelValue;
  }
  const snakeValue = raw[snake];
  return typeof snakeValue === "number" ? snakeValue : undefined;
};

const normalizeEntry = (raw: Record<string, unknown>): LocalSaveLibraryEntry | null => {
  const publicKeyHex = (readStringField(raw, "publicKeyHex", "public_key_hex") ?? "").trim().toLowerCase();
  const saveId = readStringField(raw, "saveId", "save_id");
  const absolutePath = readStringField(raw, "absolutePath", "absolute_path");
  const payloadAbsolutePath = readStringField(raw, "payloadAbsolutePath", "payload_absolute_path");
  if (
    publicKeyHex.length !== 64
    || !saveId
    || !absolutePath
    || !payloadAbsolutePath
  ) {
    return null;
  }
  const fileName = readStringField(raw, "fileName", "file_name") ?? "save.json";
  const profileLabel = readStringField(raw, "profileLabel", "profile_label") ?? undefined;
  const payloadKindRaw = readStringField(raw, "payloadKind", "payload_kind");
  const payloadFormat = readStringField(raw, "payloadFormat", "payload_format") ?? "obscur.unified_account_export.v1";
  const scanRoot = readStringField(raw, "scanRoot", "scan_root") ?? "";
  const discoveryRaw = readStringField(raw, "discovery", "discovery");
  return {
    saveId,
    absolutePath,
    payloadAbsolutePath,
    fileName,
    publicKeyHex: publicKeyHex as PublicKeyHex,
    profileLabel,
    exportedAtUnixMs: readNumberField(raw, "exportedAtUnixMs", "exported_at_unix_ms") ?? 0,
    payloadKind: payloadKindRaw === "workspace_bundle" || payloadKindRaw === "portable_account_bundle"
      ? payloadKindRaw
      : "unified_account_export",
    payloadFormat,
    payloadBytes: readNumberField(raw, "payloadBytes", "payload_bytes") ?? 0,
    modifiedAtUnixMs: readNumberField(raw, "modifiedAtUnixMs", "modified_at_unix_ms") ?? 0,
    scanRoot,
    discovery: discoveryRaw === "payload_header" ? "payload_header" : "sidecar",
  };
};

const loadScanCache = (rootsKey: string): LocalSaveLibraryScanResult | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(SCAN_CACHE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<ScanCacheRecord>;
    if (
      !parsed.result
      || parsed.rootsKey !== rootsKey
      || typeof parsed.scannedAtUnixMs !== "number"
      || Date.now() - parsed.scannedAtUnixMs > SCAN_CACHE_MAX_AGE_MS
    ) {
      return null;
    }
    return parsed.result;
  } catch {
    return null;
  }
};

const saveScanCache = (rootsKey: string, result: LocalSaveLibraryScanResult): void => {
  if (typeof window === "undefined") {
    return;
  }
  const record: ScanCacheRecord = {
    scannedAtUnixMs: Date.now(),
    rootsKey,
    result,
  };
  window.sessionStorage.setItem(SCAN_CACHE_STORAGE_KEY, JSON.stringify(record));
};

export const readLocalSavePayloadText = async (absolutePath: string): Promise<string> => {
  if (hasNativeRuntime()) {
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const bytes = await readFile(absolutePath);
    return new TextDecoder().decode(bytes);
  }
  throw new Error("Reading save files from disk requires the desktop app.");
};

export const scanLocalSaveLibrary = async (params?: Readonly<{
  force?: boolean;
  maxDepth?: number;
  maxResults?: number;
}>): Promise<LocalSaveLibraryScanResult> => {
  const roots = await buildDefaultSaveLibraryScanRoots();
  const rootsKey = roots.join("|");
  if (!params?.force) {
    const cached = loadScanCache(rootsKey);
    if (cached) {
      return cached;
    }
  }

  if (hasNativeRuntime()) {
    const runScan = async (): Promise<LocalSaveLibraryScanResult> => {
      const result = await invokeNativeCommand<LocalSaveLibraryScanResult>("desktop_scan_local_saves", {
        roots,
        maxDepth: params?.maxDepth ?? 5,
        maxResults: params?.maxResults ?? 120,
      });
      if (!result.ok || !result.value) {
        const message = !result.ok ? (result.message ?? "Local save scan failed.") : "Local save scan failed.";
        if (/not found|unknown command|unsupported/i.test(message)) {
          return {
            scannedAtUnixMs: Date.now(),
            roots,
            entries: [],
            truncated: false,
            durationMs: 0,
          };
        }
        throw new Error(message);
      }
      const normalized: LocalSaveLibraryScanResult = {
        ...result.value,
        entries: result.value.entries
          .map((entry) => normalizeEntry(entry as unknown as Record<string, unknown>))
          .filter((entry): entry is LocalSaveLibraryEntry => entry !== null),
      };
      if (normalized.entries.length > 0) {
        saveScanCache(rootsKey, normalized);
      }
      return normalized;
    };

    if (roots.length === 0) {
      throw new Error("Could not resolve Obscur data folders to scan. Restart the desktop app and try again.");
    }

    if (!params?.force && scanInFlight) {
      return scanInFlight;
    }

    const pendingScan = runScan();
    if (!params?.force) {
      scanInFlight = pendingScan;
    }
    try {
      return await pendingScan;
    } finally {
      if (scanInFlight === pendingScan) {
        scanInFlight = null;
      }
    }
  }

  const scannedAtUnixMs = Date.now();
  return {
    scannedAtUnixMs,
    roots,
    entries: [],
    truncated: false,
    durationMs: 0,
  };
};

export const parseLocalSaveSidecarFromText = (rawJson: string): ReturnType<typeof parseObscurLocalSaveSidecar> => {
  try {
    return parseObscurLocalSaveSidecar(JSON.parse(rawJson));
  } catch {
    return null;
  }
};

export const formatLocalSaveAgeLabel = (exportedAtUnixMs: number): string => {
  const deltaMs = Math.max(0, Date.now() - exportedAtUnixMs);
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};
