/**
 * Use CRDT Sync Hook
 *
 * React hook for CRDT synchronization operations.
 * Provides sync status, progress tracking, and manual sync triggers.
 *
 * @example
 * ```tsx
 * function SyncButton() {
 *   const { isSyncing, progress, syncNow } = useCRDTSync({
 *     profileId: "my-profile",
 *     deviceId: "device-123"
 *   });
 *
 *   return (
 *     <button onClick={syncNow} disabled={isSyncing}>
 *       {isSyncing ? `Syncing ${progress?.percent}%` : 'Sync Now'}
 *     </button>
 *   );
 * }
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  batchSync,
  type SerializedCRDT,
  type SyncOptions,
  type SyncProgressCallback,
  type SyncResult,
  type SyncNamespace,
} from "../services/crdt-sync-protocol.js";

/** Sync state */
export interface SyncState {
  /** Whether sync is in progress */
  isSyncing: boolean;
  /** Current progress (0-100) */
  progress: number;
  /** Current phase */
  phase: string;
  /** Last error */
  error: Error | null;
  /** Last sync timestamp */
  lastSyncAt: number | null;
  /** Total entities synced */
  entitiesSynced: number;
}

/** Hook options */
export interface UseCRDTSyncOptions {
  /** Profile ID */
  profileId: string;
  /** Device ID */
  deviceId: string;
  /** Auto-sync interval (ms, undefined = no auto-sync) */
  autoSyncIntervalMs?: number;
  /** Namespaces to sync (undefined = all) */
  namespaces?: SyncNamespace[];
  /** Callback when sync completes */
  onSyncComplete?: (results: Map<string, SyncResult<unknown>>) => void;
  /** Callback on sync error */
  onSyncError?: (error: Error) => void;
}

/** Hook return value */
export interface UseCRDTSyncResult {
  /** Current sync state */
  state: SyncState;
  /** Trigger manual sync */
  syncNow: (snapshots?: SerializedCRDT[]) => Promise<void>;
  /** Export current state as snapshots */
  exportState: () => SerializedCRDT[];
  /** Reset error state */
  clearError: () => void;
}

/**
 * React hook for CRDT synchronization.
 */
export const useCRDTSync = (options: UseCRDTSyncOptions): UseCRDTSyncResult => {
  const { deviceId, autoSyncIntervalMs, namespaces, onSyncComplete, onSyncError } = options;
  // profileId used for storage keys in real implementation
  void options.profileId;

  // Sync state
  const [state, setState] = useState<SyncState>({
    isSyncing: false,
    progress: 0,
    phase: "idle",
    error: null,
    lastSyncAt: null,
    entitiesSynced: 0,
  });

  // Refs for callbacks (avoid re-subscription)
  const onCompleteRef = useRef(onSyncComplete);
  const onErrorRef = useRef(onSyncError);

  // Sync function - defined before useEffect that references it
  const syncNow = useCallback(
    async (externalSnapshots?: SerializedCRDT[]): Promise<void> => {
      if (state.isSyncing) return;

      setState((prev) => ({
        ...prev,
        isSyncing: true,
        progress: 0,
        phase: "starting",
        error: null,
      }));

      try {
        // Progress callback
        const onProgress: SyncProgressCallback = (progress) => {
          const percent =
            progress.phase === "deserialize"
              ? 25
              : progress.phase === "validate"
              ? 50
              : progress.phase === "merge"
              ? 75
              : 100;

          setState((prev) => ({
            ...prev,
            progress: percent,
            phase: progress.phase,
          }));
        };

        const syncOptions: SyncOptions = {
          deviceId,
          onProgress,
          validateChecksums: true,
          maxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
        };

        // TODO: Get actual local states from stores
        const localStates: Record<string, unknown> = {};

        // Get snapshots to sync
        const snapshotsToSync = externalSnapshots ?? [];

        // Filter by namespace if specified
        const filteredSnapshots = namespaces
          ? snapshotsToSync.filter((s) => namespaces.includes(s.namespace))
          : snapshotsToSync;

        // Perform batch sync
        const { results, allSucceeded } = batchSync(
          localStates,
          filteredSnapshots,
          syncOptions
        );

        // Update state
        setState((prev) => ({
          ...prev,
          isSyncing: false,
          progress: 100,
          phase: "complete",
          lastSyncAt: Date.now(),
          entitiesSynced: results.size,
        }));

        // Notify completion
        onCompleteRef.current?.(results);

        if (!allSucceeded) {
          console.warn("[CRDTSync] Some entities failed to sync");
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        setState((prev) => ({
          ...prev,
          isSyncing: false,
          error: err,
          phase: "error",
        }));

        onErrorRef.current?.(err);
      }
    },
    [deviceId, namespaces, state.isSyncing]
  );

  useEffect(() => {
    onCompleteRef.current = onSyncComplete;
    onErrorRef.current = onSyncError;
  }, [onSyncComplete, onSyncError]);

  useEffect(() => {
    if (!autoSyncIntervalMs) return;

    const interval = setInterval(() => {
      void syncNow();
    }, autoSyncIntervalMs);

    return () => clearInterval(interval);
  }, [autoSyncIntervalMs, syncNow]);

  // Export state function
  const exportState = useCallback((): SerializedCRDT[] => {
    // TODO: Export actual CRDT states from stores
    // Placeholder implementation
    return [];
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    state,
    syncNow,
    exportState,
    clearError,
  };
};

/**
 * Hook for checking if sync is needed.
 */
export const useSyncStatus = (
  profileId: string
): {
  lastSyncAt: number | null;
  isStale: boolean;
  hoursSinceSync: number | null;
} => {
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  useEffect(() => {
    // Load last sync timestamp from storage
    const stored = localStorage.getItem(`sync:last:${profileId}`);
    if (stored) {
      setLastSyncAt(parseInt(stored, 10));
    }
  }, [profileId]);

  // Calculate staleness using state to avoid impure Date.now during render
  const [hoursSinceSync, setHoursSinceSync] = useState<number | null>(null);

  useEffect(() => {
    const calculated = lastSyncAt
      ? Math.floor((Date.now() - lastSyncAt) / (1000 * 60 * 60))
      : null;
    setHoursSinceSync(calculated);
  }, [lastSyncAt]);

  const isStale = hoursSinceSync === null || hoursSinceSync > 24; // 24 hour staleness

  return {
    lastSyncAt,
    isStale,
    hoursSinceSync,
  };
};

/**
 * Hook for incremental sync (delta sync).
 */
export const useIncrementalSync = (
  options: UseCRDTSyncOptions & {
    checkpoint: unknown;
  }
): UseCRDTSyncResult & {
  pendingDeltas: number;
} => {
  const baseSync = useCRDTSync(options);
  const [pendingDeltas] = useState(0);

  // TODO: Implement actual delta sync
  // This would compare vector clocks or state hashes
  // to determine what data is missing on remote

  return {
    ...baseSync,
    pendingDeltas,
  };
};
