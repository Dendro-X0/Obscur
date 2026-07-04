"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@dweb/ui-kit";
import { FolderOpen, FolderPlus, FolderSearch, Loader2, RefreshCw } from "lucide-react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { scanLocalSaveLibrary } from "@/app/features/profiles/services/local-save-library-service";
import type { LocalSaveLibraryEntry } from "@/app/features/profiles/services/local-save-contracts";
import {
  getLocalSaveLibraryScanBootstrapState,
  startLocalSaveLibraryWindowBootstrap,
  subscribeLocalSaveLibraryScanBootstrap,
} from "@/app/features/profiles/services/local-save-library-scan-bootstrap";
import {
  addExtraSaveLibraryScanRoot,
  getSaveLibraryContext,
  type SaveLibraryContext,
} from "@/app/features/profiles/services/local-save-scan-roots";
import { openExportsFolderInFileManager } from "@/app/features/profiles/services/data-root-export-service";
import { desktopProfileRuntime } from "@/app/features/profiles/services/desktop-profile-runtime";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  resolveLocalSaveAccountOccupancy,
  type LocalSaveAccountOccupancy,
} from "@/app/features/profiles/services/local-save-account-occupancy";
import type { ProfileSummary } from "@/app/features/profiles/services/profile-isolation-contracts";
import { openObscurDataRootPath, pickObscurDataRootPath } from "@/app/features/profiles/services/obscur-data-root-service";
import {
  ACTIVE_SESSION_LEASE_HEARTBEAT_MS,
} from "@/app/features/profiles/services/cross-profile-active-session-lease";
import { LocalSaveLibraryRow } from "./local-save-library-row";

const ACTIVE_SESSION_LEASE_STORAGE_KEY = "obscur.cross_profile.active_session_leases.v1";

type Props = Readonly<{
  activePublicKeyHex?: PublicKeyHex | null;
  onSelectSave?: (entry: LocalSaveLibraryEntry) => Promise<void>;
}>;

const shortenPath = (path: string): string => {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.length <= 56) {
    return path;
  }
  return `…${normalized.slice(-52)}`;
};

export function AuthScreenLocalSaveLibrary(props: Props): React.JSX.Element | null {
  const { t } = useTranslation();
  const [isScanning, setIsScanning] = useState(false);
  const [entries, setEntries] = useState<ReadonlyArray<LocalSaveLibraryEntry>>([]);
  const [scanMs, setScanMs] = useState<number | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanRoots, setScanRoots] = useState<ReadonlyArray<string>>([]);
  const [libraryContext, setLibraryContext] = useState<SaveLibraryContext | null>(null);
  const [profiles, setProfiles] = useState<ReadonlyArray<ProfileSummary>>([]);
  const [selectedSaveId, setSelectedSaveId] = useState<string | null>(null);
  const [occupancyRefreshTick, setOccupancyRefreshTick] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadContext = useCallback(async (): Promise<SaveLibraryContext | null> => {
    const [context, listedProfiles] = await Promise.all([
      getSaveLibraryContext(),
      desktopProfileRuntime.listProfiles(),
    ]);
    if (mountedRef.current) {
      if (context) {
        setLibraryContext(context);
      }
      setProfiles(listedProfiles);
    }
    return context;
  }, []);

  const resolveOccupancy = useCallback((entry: LocalSaveLibraryEntry): LocalSaveAccountOccupancy => (
    resolveLocalSaveAccountOccupancy({
      publicKeyHex: entry.publicKeyHex,
      currentProfileId: getResolvedProfileId(),
      profiles,
    })
  ), [profiles, occupancyRefreshTick]);

  useEffect(() => {
    if (!hasNativeRuntime()) {
      return;
    }
    const refreshOccupancy = (): void => {
      setOccupancyRefreshTick((value) => value + 1);
    };
    const onStorage = (event: StorageEvent): void => {
      if (event.key === ACTIVE_SESSION_LEASE_STORAGE_KEY) {
        refreshOccupancy();
      }
    };
    window.addEventListener("storage", onStorage);
    const intervalId = window.setInterval(refreshOccupancy, ACTIVE_SESSION_LEASE_HEARTBEAT_MS);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(intervalId);
    };
  }, []);

  const applyBootstrapResult = useCallback((
    result: NonNullable<ReturnType<typeof getLocalSaveLibraryScanBootstrapState>["result"]>,
  ): void => {
    setEntries(result.entries);
    setScanMs(result.durationMs);
    setTruncated(result.truncated);
    setScanRoots(result.roots);
  }, []);

  const refreshLibrary = useCallback(async (force = true): Promise<void> => {
    setIsScanning(true);
    setScanError(null);
    try {
      await loadContext();
      const result = await scanLocalSaveLibrary({ force, maxDepth: 5, maxResults: 240 });
      if (!mountedRef.current) {
        return;
      }
      applyBootstrapResult(result);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      setScanError(error instanceof Error ? error.message : t("profiles.portability.localSave.scanError"));
      setEntries([]);
    } finally {
      if (mountedRef.current) {
        setIsScanning(false);
      }
    }
  }, [applyBootstrapResult, loadContext, t]);

  useEffect(() => {
    if (!hasNativeRuntime()) {
      return;
    }
    void loadContext();
    const initialState = getLocalSaveLibraryScanBootstrapState();
    if (initialState.result) {
      applyBootstrapResult(initialState.result);
    }
    if (initialState.error) {
      setScanError(initialState.error);
    }
    setIsScanning(initialState.phase === "fast" || initialState.phase === "deep");

    const unsubscribe = subscribeLocalSaveLibraryScanBootstrap((state) => {
      if (!mountedRef.current) {
        return;
      }
      if (state.result) {
        applyBootstrapResult(state.result);
      }
      if (state.error) {
        setScanError(state.error);
      } else if (state.phase !== "error") {
        setScanError(null);
      }
      setIsScanning(state.phase === "fast" || state.phase === "deep");
    });

    if (initialState.phase === "idle") {
      void startLocalSaveLibraryWindowBootstrap();
    }

    return unsubscribe;
  }, [applyBootstrapResult, loadContext]);

  if (!hasNativeRuntime()) {
    return null;
  }

  const handleSelect = async (entry: LocalSaveLibraryEntry): Promise<void> => {
    if (!props.onSelectSave) {
      return;
    }
    setSelectedSaveId(entry.saveId);
    try {
      await props.onSelectSave(entry);
    } finally {
      setSelectedSaveId(null);
    }
  };

  const handleAddFolder = async (): Promise<void> => {
    const picked = await pickObscurDataRootPath();
    if (!picked?.trim()) {
      return;
    }
    addExtraSaveLibraryScanRoot(picked);
    await refreshLibrary(true);
  };

  return (
    <div className="w-full rounded-[24px] border border-sky-500/20 bg-sky-500/5 px-4 py-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
            {t("profiles.portability.localSave.title")}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            {t("profiles.portability.localSave.subtitle")}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          disabled={isScanning}
          onClick={() => { void refreshLibrary(true); }}
          aria-label={t("profiles.portability.localSave.rescanAria")}
        >
          {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {entries.length > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              {t("profiles.portability.localSave.saveSlotCount", { count: entries.length })}
            </div>
            {scanMs !== null ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                {t("profiles.portability.localSave.scannedIn", { ms: scanMs })}
                {truncated ? ` · ${t("profiles.portability.localSave.truncated")}` : ""}
              </span>
            ) : null}
          </div>
          <ul className="max-h-[min(420px,55vh)] space-y-3 overflow-y-auto px-0.5 py-1">
            {entries.map((entry, index) => {
              const occupancy = resolveOccupancy(entry);
              return (
                <li key={entry.saveId}>
                  <LocalSaveLibraryRow
                    entry={entry}
                    slotIndex={index + 1}
                    occupancy={occupancy}
                    isSelecting={selectedSaveId === entry.saveId}
                    disabled={!props.onSelectSave || (selectedSaveId !== null && selectedSaveId !== entry.saveId)}
                    onSelect={() => { void handleSelect(entry); }}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {isScanning && entries.length === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-black/5 bg-white/40 px-4 py-3 text-xs text-zinc-500 dark:border-white/10 dark:bg-zinc-900/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("profiles.portability.localSave.scanning")}
        </div>
      ) : null}

      {!isScanning && !scanError && entries.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-300/60 bg-white/30 px-4 py-4 text-xs leading-relaxed text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/30">
          {t("profiles.portability.localSave.empty")}
        </div>
      ) : null}

      {scanError ? (
        <p className="mt-4 text-xs text-amber-700 dark:text-amber-300">{scanError}</p>
      ) : null}

      <details className="mt-4 rounded-2xl border border-black/5 bg-white/30 px-3 py-2 dark:border-white/10 dark:bg-zinc-900/30">
        <summary className="cursor-pointer text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          {t("profiles.portability.localSave.browseFolders")}
        </summary>
        <div className="mt-3 space-y-3">
          {libraryContext ? (
            <div className="rounded-xl border border-black/5 bg-white/40 px-3 py-2 dark:border-white/10 dark:bg-zinc-900/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {t("profiles.portability.localSave.defaultExportFolder")}
              </div>
              <p className="mt-1 break-all font-mono text-[11px] text-zinc-700 dark:text-zinc-300" title={libraryContext.exportsFolderPath}>
                {shortenPath(libraryContext.exportsFolderPath)}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold"
              onClick={() => { void openExportsFolderInFileManager(); }}
            >
              <FolderSearch className="h-3.5 w-3.5" />
              {t("profiles.portability.localSave.openExportFolder")}
            </Button>
            {libraryContext?.dataRootPath ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs font-bold"
                onClick={() => { void openObscurDataRootPath(libraryContext.dataRootPath); }}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                {t("profiles.portability.localSave.openDataFolder")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-bold"
              disabled={isScanning}
              onClick={() => { void handleAddFolder(); }}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              {t("profiles.portability.localSave.addFolderToSearch")}
            </Button>
          </div>

          {scanRoots.length > 0 ? (
            <ul className="max-h-24 space-y-1 overflow-y-auto font-mono text-[10px] leading-relaxed text-zinc-500">
              {scanRoots.map((root) => (
                <li key={root} className="break-all" title={root}>{root}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </details>
    </div>
  );
}
