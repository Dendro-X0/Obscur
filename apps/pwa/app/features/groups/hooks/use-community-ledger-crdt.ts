/**
 * useCommunityLedgerCRDT Hook
 * 
 * React hook that wraps the CRDT-based community ledger reducer.
 * Provides member list state with OR-Set semantics to prevent thinning.
 * 
 * Key benefits:
 * - All concurrent member additions are preserved during sync
 * - MERGE_STATE event enables proper cross-device synchronization
 * - Drop-in replacement for legacy community ledger state
 */

"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityControlEvent } from "@dweb/core/community-control-event-contracts";
import {
  createCommunityLedgerCRDTState,
  reduceCommunityLedgerCRDT,
  getActiveMembers,
  isActiveMember,
  toCommunityLedgerCRDTEventFromControlEvent,
  migrateLegacyToCRDT,
  type CommunityLedgerCRDTState,
  type CommunityLedgerCRDTEvent,
} from "../services/community-ledger-crdt-reducer";

export interface UseCommunityLedgerCRDTReturn {
  /** Current CRDT state (for debugging/advanced use) */
  state: CommunityLedgerCRDTState;
  
  /** List of active member pubkeys */
  members: PublicKeyHex[];
  
  /** Number of active members */
  memberCount: number;
  
  /** Check if a pubkey is an active member */
  isMember: (pubkey: PublicKeyHex) => boolean;
  
  /** Apply a CRDT event to the ledger */
  applyEvent: (event: CommunityLedgerCRDTEvent) => void;
  
  /** Apply a legacy control event (auto-converts to CRDT) */
  applyControlEvent: (event: CommunityControlEvent, actor?: string) => void;
  
  /** Merge state from another device/source */
  mergeState: (otherState: CommunityLedgerCRDTState) => void;
  
  /** Initialize from legacy member list (migration) */
  initializeFromLegacy: (legacyMembers: PublicKeyHex[], actor?: string) => void;
  
  /** Reset to empty state */
  reset: () => void;
  
  /** Whether the ledger has been initialized */
  isInitialized: boolean;
}

/**
 * React hook for CRDT-based community ledger
 * 
 * @param initialMembers - Optional initial member list for initialization
 * @param actor - The actor/device identifier for this instance
 */
export const useCommunityLedgerCRDT = (
  initialMembers?: PublicKeyHex[],
  actor?: string
): UseCommunityLedgerCRDTReturn => {
  const [state, setState] = useState<CommunityLedgerCRDTState>(() =>
    initialMembers
      ? createCommunityLedgerCRDTState(initialMembers, actor)
      : createCommunityLedgerCRDTState([], actor)
  );
  const [isInitialized, setIsInitialized] = useState(initialMembers !== undefined);
  
  // Track latest state in ref for stable callbacks
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /**
   * Apply a CRDT event to update the ledger
   */
  const applyEvent = useCallback((event: CommunityLedgerCRDTEvent) => {
    setState((current) => reduceCommunityLedgerCRDT(current, event));
  }, []);

  /**
   * Apply a legacy control event (auto-converts)
   */
  const applyControlEvent = useCallback((
    controlEvent: CommunityControlEvent,
    eventActor?: string
  ) => {
    const crdtEvent = toCommunityLedgerCRDTEventFromControlEvent(
      controlEvent,
      eventActor ?? actor
    );
    if (crdtEvent) {
      applyEvent(crdtEvent);
    }
  }, [applyEvent, actor]);

  /**
   * Merge state from another device (sync)
   * This is the key operation that prevents member thinning!
   */
  const mergeState = useCallback((otherState: CommunityLedgerCRDTState) => {
    setState((current) =>
      reduceCommunityLedgerCRDT(current, {
        type: "MERGE_STATE",
        otherState,
        timestamp: Date.now(),
      })
    );
  }, []);

  /**
   * Initialize from legacy member list (migration path)
   */
  const initializeFromLegacy = useCallback((
    legacyMembers: PublicKeyHex[],
    initActor?: string
  ) => {
    setState(migrateLegacyToCRDT(legacyMembers, initActor ?? actor));
    setIsInitialized(true);
  }, [actor]);

  /**
   * Reset to empty state
   */
  const reset = useCallback(() => {
    setState(createCommunityLedgerCRDTState([], actor));
    setIsInitialized(false);
  }, [actor]);

  /**
   * Derived values (memoized)
   */
  const members = useMemo(() => getActiveMembers(state), [state]);
  const memberCount = useMemo(() => members.length, [members]);

  /**
   * Check if a pubkey is an active member
   */
  const isMember = useCallback(
    (pubkey: PublicKeyHex) => isActiveMember(state, pubkey),
    [state]
  );

  return {
    state,
    members,
    memberCount,
    isMember,
    applyEvent,
    applyControlEvent,
    mergeState,
    initializeFromLegacy,
    reset,
    isInitialized,
  };
};

/**
 * Hook for syncing community ledger across multiple sources
 * Manages merging state from relays, local storage, etc.
 */
export const useCommunityLedgerSync = (
  baseLedger: UseCommunityLedgerCRDTReturn,
  sources: Array<{
    id: string;
    getState: () => Promise<CommunityLedgerCRDTState | null>;
  }>,
  options?: {
    syncIntervalMs?: number;
    onSyncError?: (sourceId: string, error: Error) => void;
  }
): {
  isSyncing: boolean;
  lastSyncAt: number | null;
  syncErrors: Array<{ sourceId: string; error: string }>;
  forceSync: () => Promise<void>;
} => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncErrors, setSyncErrors] = useState<Array<{ sourceId: string; error: string }>>([]);

  const syncIntervalMs = options?.syncIntervalMs ?? 30000; // 30 seconds default

  /**
   * Perform sync with all sources
   */
  const performSync = useCallback(async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    const errors: Array<{ sourceId: string; error: string }> = [];

    try {
      // Fetch state from all sources concurrently
      const results = await Promise.allSettled(
        sources.map(async (source) => ({
          sourceId: source.id,
          state: await source.getState(),
        }))
      );

      // Merge successful results
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.state) {
          baseLedger.mergeState(result.value.state);
        } else if (result.status === "rejected") {
          const sourceId = result.reason?.sourceId ?? "unknown";
          const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
          errors.push({ sourceId, error });
          options?.onSyncError?.(sourceId, result.reason);
        }
      }

      setLastSyncAt(Date.now());
      setSyncErrors(errors);
    } finally {
      setIsSyncing(false);
    }
  }, [baseLedger, sources, options, isSyncing]);

  /**
   * Periodic sync
   */
  useEffect(() => {
    // Initial sync
    performSync();

    // Periodic sync
    const interval = setInterval(performSync, syncIntervalMs);
    return () => clearInterval(interval);
  }, [performSync, syncIntervalMs]);

  return {
    isSyncing,
    lastSyncAt,
    syncErrors,
    forceSync: performSync,
  };
};

export default useCommunityLedgerCRDT;
