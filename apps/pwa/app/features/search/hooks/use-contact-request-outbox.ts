"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import type { ContactRequestRecord, ContactRequestStatus } from "@/app/features/search/types/discovery";
import type { ConnectionRequestStatusValue, MessageActionFailureReason, RequestSendBlockReason } from "@/app/features/messaging/types";
import { requestFlowEvidenceStore } from "@/app/features/messaging/services/request-flow-evidence-store";
import { relayTransportJournal } from "@/app/features/relays/services/relay-transport-journal";

type SendConnectionRequestResult = Readonly<{
  success: boolean;
  deliveryStatus?: "sent_quorum" | "sent_partial" | "queued_retrying" | "failed";
  retryAtUnixMs?: number;
  relayResults: ReadonlyArray<Readonly<{
    relayUrl: string;
    success: boolean;
    error?: string;
  }>>;
  error?: string;
  failureReason?: MessageActionFailureReason;
  blockReason?: RequestSendBlockReason;
}>;

type UseContactRequestOutboxParams = Readonly<{
  myPublicKeyHex: PublicKeyHex | null;
  sendConnectionRequest: (params: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    introMessage?: string;
  }>) => Promise<SendConnectionRequestResult>;
  getRequestStatus: (params: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
  }>) => Readonly<{ status?: "pending" | "accepted" | "declined" | "canceled"; isOutgoing: boolean }> | null;
  setRequestStatus?: (params: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    status: ConnectionRequestStatusValue;
    isOutgoing?: boolean;
  }>) => void;
}>;

type OutboxState = Readonly<{
  records: ReadonlyArray<ContactRequestRecord>;
}>;

const getStorageKey = (): string => getScopedStorageKey("obscur.discovery.contact_request_outbox.v1");
const RETRY_BASE_MS = 1500;
const MAX_RETRY_MS = 60_000;
const MAX_REQUEST_RETRY_ATTEMPTS = 5;

const readState = (): OutboxState => {
  if (typeof window === "undefined") return { records: [] };
  try {
    const raw = window.localStorage.getItem(getStorageKey());
    if (!raw) return { records: [] };
    const parsed = JSON.parse(raw) as OutboxState;
    if (!Array.isArray(parsed?.records)) return { records: [] };
    return parsed;
  } catch {
    return { records: [] };
  }
};

const writeState = (state: OutboxState): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getStorageKey(), JSON.stringify(state));
  } catch {
    // Ignore cache write failures.
  }
};

const nextRetryDelayMs = (retries: number): number => {
  const exponential = RETRY_BASE_MS * Math.pow(2, retries);
  const jitter = Math.floor(Math.random() * 450);
  return Math.min(exponential + jitter, MAX_RETRY_MS);
};

const hasExceededRetryBudget = (
  retries: number,
  maxRetryAttempts = MAX_REQUEST_RETRY_ATTEMPTS
): boolean => retries >= maxRetryAttempts;

const toUpdatedRecord = (
  prev: ContactRequestRecord,
  patch: Partial<ContactRequestRecord>
): ContactRequestRecord => ({
  ...prev,
  ...patch,
  updatedAtUnixMs: Date.now(),
});

const shouldScheduleRetry = (
  result: SendConnectionRequestResult,
  successCount: number,
): boolean => {
  if (result.deliveryStatus === "queued_retrying") {
    return true;
  }
  if (result.success && successCount === 0) {
    // Success without any relay evidence is ambiguous; retry deterministically.
    return true;
  }
  if (result.success || successCount > 0) {
    return false;
  }
  if (result.blockReason) {
    return false;
  }
  if (!result.failureReason) {
    return true;
  }
  // Request can recover when relay/network/storage path is transient.
  return [
    "no_active_relays",
    "insufficient_writable_relays",
    "quorum_not_met",
    "publish_rejected",
    "storage_unavailable",
    "sync_failed",
  ].includes(result.failureReason);
};

const applySendResultToOutboxRecord = (
  record: ContactRequestRecord,
  result: SendConnectionRequestResult,
  nowUnixMs = Date.now(),
): ContactRequestRecord => {
  const successCount = result.relayResults.filter((entry) => entry.success).length;
  const totalRelays = result.relayResults.length;
  const failures = result.relayResults.filter((entry) => !entry.success).map((entry) => ({
    relayUrl: entry.relayUrl,
    error: entry.error,
  }));

  const hasFullDeliveryEvidence = (
    result.deliveryStatus === "sent_quorum"
    || (result.success && totalRelays > 0 && successCount === totalRelays)
  );
  if (hasFullDeliveryEvidence) {
    return toUpdatedRecord(record, {
      status: "sent_quorum",
      publishReport: {
        successCount,
        totalRelays,
        metQuorum: true,
        failures,
      },
      error: undefined,
      failureReason: undefined,
      blockReason: undefined,
    });
  }

  const hasPartialDeliveryEvidence = (
    result.deliveryStatus === "sent_partial"
    || (result.success && successCount > 0)
    || successCount > 0
  );
  if (hasPartialDeliveryEvidence) {
    return toUpdatedRecord(record, {
      status: "sent_partial",
      publishReport: {
        successCount,
        totalRelays,
        metQuorum: false,
        failures,
      },
      error: result.error,
      failureReason: result.failureReason,
      blockReason: result.blockReason,
    });
  }

  if (!shouldScheduleRetry(result, successCount)) {
    return toUpdatedRecord(record, {
      status: "failed",
      error: result.error || "Request blocked. Check connection state and recipient details.",
      nextRetryAtUnixMs: undefined,
      publishReport: {
        successCount,
        totalRelays,
        metQuorum: false,
        failures,
      },
      failureReason: result.failureReason,
      blockReason: result.blockReason,
    });
  }

  const retries = record.retries + 1;
  if (hasExceededRetryBudget(retries)) {
    return toUpdatedRecord(record, {
      status: "failed",
      retries,
      nextRetryAtUnixMs: undefined,
      error: "Request retry budget exhausted. Retry manually after checking relay health.",
      publishReport: {
        successCount,
        totalRelays,
        metQuorum: false,
        failures,
      },
      failureReason: "max_retries_exceeded",
      blockReason: result.blockReason,
    });
  }

  return toUpdatedRecord(record, {
    status: "failed",
    retries,
    nextRetryAtUnixMs: result.retryAtUnixMs ?? (nowUnixMs + nextRetryDelayMs(retries)),
    error: result.error || "Failed to publish request. Will retry automatically.",
    publishReport: {
      successCount,
      totalRelays,
      metQuorum: false,
      failures,
    },
    failureReason: result.failureReason,
    blockReason: result.blockReason,
  });
};

const syncResolvedStatuses = (
  records: ReadonlyArray<ContactRequestRecord>,
  getRequestStatus: UseContactRequestOutboxParams["getRequestStatus"]
): ReadonlyArray<ContactRequestRecord> => {
  return records.map((record) => {
    const status = getRequestStatus({ peerPublicKeyHex: record.peerPubkey as PublicKeyHex });
    if (!status) return record;
    if (status.status === "accepted") {
      return toUpdatedRecord(record, { status: "accepted" });
    }
    if (status.status === "declined" || status.status === "canceled") {
      return toUpdatedRecord(record, { status: "rejected" });
    }
    return record;
  });
};

const shouldReleaseOutgoingPendingAfterOutboxFailure = (
  record: ContactRequestRecord,
  requestStatus: ReturnType<UseContactRequestOutboxParams["getRequestStatus"]>,
  nowUnixMs = Date.now()
): boolean => {
  if (!requestStatus?.isOutgoing) {
    return false;
  }
  if (requestStatus.status && requestStatus.status !== "pending") {
    return false;
  }
  if (record.status !== "failed") {
    return false;
  }
  if (record.nextRetryAtUnixMs && record.nextRetryAtUnixMs > nowUnixMs) {
    return false;
  }
  return true;
};

const reconcileRequestStatusFromOutbox = (
  record: ContactRequestRecord,
  getRequestStatus: UseContactRequestOutboxParams["getRequestStatus"],
  setRequestStatus: UseContactRequestOutboxParams["setRequestStatus"] | undefined,
): void => {
  if (!setRequestStatus) {
    return;
  }
  const requestStatus = getRequestStatus({
    peerPublicKeyHex: record.peerPubkey as PublicKeyHex
  });
  if (!shouldReleaseOutgoingPendingAfterOutboxFailure(record, requestStatus)) {
    return;
  }
  setRequestStatus({
    peerPublicKeyHex: record.peerPubkey as PublicKeyHex,
    status: "canceled",
    isOutgoing: true,
  });
  requestFlowEvidenceStore.markTerminalFailure({
    peerPublicKeyHex: record.peerPubkey,
  });
};

export const contactRequestOutboxInternals = {
  getStorageKey,
  readState,
  writeState,
  nextRetryDelayMs,
  hasExceededRetryBudget,
  MAX_REQUEST_RETRY_ATTEMPTS,
  toUpdatedRecord,
  syncResolvedStatuses,
  shouldScheduleRetry,
  applySendResultToOutboxRecord,
  shouldReleaseOutgoingPendingAfterOutboxFailure,
  reconcileRequestStatusFromOutbox,
};

export const useContactRequestOutbox = (params: UseContactRequestOutboxParams) => {
  const [state, setState] = useState<OutboxState>(() => readState());
  const processingRef = useRef(false);
  const pendingOutboundCount = useMemo(() => {
    return state.records.filter((record) => {
      if (record.status === "queued" || record.status === "publishing") {
        return true;
      }
      return record.status === "failed" && typeof record.nextRetryAtUnixMs === "number";
    }).length;
  }, [state.records]);

  useEffect(() => {
    setState(readState());
  }, [params.myPublicKeyHex]);

  useEffect(() => {
    setState((prev) => {
      const next = { records: syncResolvedStatuses(prev.records, params.getRequestStatus) };
      writeState(next);
      return next;
    });
  }, [params.getRequestStatus]);

  const setRecords = useCallback((updater: (records: ReadonlyArray<ContactRequestRecord>) => ReadonlyArray<ContactRequestRecord>) => {
    setState((prev) => {
      const next = { records: updater(prev.records) };
      writeState(next);
      return next;
    });
  }, []);

  const queueRequest = useCallback((payload: Readonly<{
    peerPubkey: PublicKeyHex;
    introMessage?: string;
  }>): ContactRequestRecord => {
    const now = Date.now();
    const record: ContactRequestRecord = {
      id: `req-${now}-${Math.random().toString(36).slice(2, 8)}`,
      peerPubkey: payload.peerPubkey,
      introMessage: payload.introMessage,
      status: "queued",
      retries: 0,
      createdAtUnixMs: now,
      updatedAtUnixMs: now,
    };
    setRecords((records) => [record, ...records]);
    return record;
  }, [setRecords]);

  const processOne = useCallback(async (record: ContactRequestRecord): Promise<ContactRequestRecord> => {
    const publishing = toUpdatedRecord(record, {
      status: "publishing",
      error: undefined,
      failureReason: undefined,
      blockReason: undefined,
    });
    setRecords((records) => records.map((item) => (item.id === record.id ? publishing : item)));
    const result = await params.sendConnectionRequest({
      peerPublicKeyHex: record.peerPubkey as PublicKeyHex,
      introMessage: record.introMessage,
    });
    return applySendResultToOutboxRecord(record, result, Date.now());
  }, [params, setRecords]);

  const processQueue = useCallback(async (): Promise<void> => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      const current = readState().records;
      const normalized = syncResolvedStatuses(current, params.getRequestStatus);
      writeState({ records: normalized });
      const now = Date.now();
      const candidates = normalized.filter((record) => {
        if (record.status === "queued") return true;
        if (record.status === "failed") return (record.nextRetryAtUnixMs ?? 0) <= now;
        return false;
      });
      if (candidates.length === 0) {
        setState({ records: normalized });
        return;
      }
      for (const candidate of candidates.slice(0, 3)) {
        const updated = await processOne(candidate);
        setRecords((records) => records.map((entry) => (entry.id === candidate.id ? updated : entry)));
        reconcileRequestStatusFromOutbox(updated, params.getRequestStatus, params.setRequestStatus);
      }
    } finally {
      processingRef.current = false;
    }
  }, [params.getRequestStatus, processOne, setRecords]);

  useEffect(() => {
    const timer = setInterval(() => {
      void processQueue();
    }, 2000);
    return () => clearInterval(timer);
  }, [processQueue]);

  useEffect(() => {
    const source = "contact_request_outbox";
    relayTransportJournal.setPendingOutbound(source, pendingOutboundCount);
    return () => {
      relayTransportJournal.clearPendingOutbound(source);
    };
  }, [pendingOutboundCount]);

  const markTerminal = useCallback((peerPubkey: PublicKeyHex, status: Extract<ContactRequestStatus, "accepted" | "rejected" | "expired">): void => {
    setRecords((records) => records.map((record) => {
      if (record.peerPubkey !== peerPubkey) return record;
      return toUpdatedRecord(record, { status });
    }));
  }, [setRecords]);

  const retryNow = useCallback((id: string): void => {
    setRecords((records) => records.map((record) => {
      if (record.id !== id) return record;
      return toUpdatedRecord(record, {
        status: "queued",
        nextRetryAtUnixMs: undefined,
        error: undefined,
        failureReason: undefined,
        blockReason: undefined,
      });
    }));
    void processQueue();
  }, [processQueue, setRecords]);

  const clearTerminal = useCallback((): void => {
    setRecords((records) => records.filter((record) => {
      return !["accepted", "rejected", "expired"].includes(record.status);
    }));
  }, [setRecords]);

  return useMemo(() => ({
    state,
    queueRequest,
    processQueue,
    markTerminal,
    retryNow,
    clearTerminal,
  }), [state, queueRequest, processQueue, markTerminal, retryNow, clearTerminal]);
};
