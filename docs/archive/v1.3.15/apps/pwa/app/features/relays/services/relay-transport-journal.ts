"use client";

import type {
  RelaySubscriptionReplayReasonCode,
  RelaySubscriptionReplayResult,
} from "./relay-runtime-contracts";

type Listener = () => void;

export type RelayTransportJournalSnapshot = Readonly<{
  desiredSubscriptionCount: number;
  pendingSubscriptionBatchCount: number;
  pendingOutboundCount: number;
  pendingOutboundBySource: Readonly<Record<string, number>>;
  lastSubscriptionReplayAttemptAtUnixMs?: number;
  lastSubscriptionReplayResultAtUnixMs?: number;
  lastSubscriptionReplayReasonCode?: RelaySubscriptionReplayReasonCode;
  lastSubscriptionReplayResult?: RelaySubscriptionReplayResult;
  lastSubscriptionReplayDetail?: string;
  updatedAtUnixMs: number;
}>;

const createDefaultSnapshot = (): RelayTransportJournalSnapshot => ({
  desiredSubscriptionCount: 0,
  pendingSubscriptionBatchCount: 0,
  pendingOutboundCount: 0,
  pendingOutboundBySource: {},
  updatedAtUnixMs: Date.now(),
});

const listeners = new Set<Listener>();
let snapshot: RelayTransportJournalSnapshot = createDefaultSnapshot();
const pendingOutboundBySource = new Map<string, number>();

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

const summarizePendingOutbound = (): Readonly<Record<string, number>> => {
  const next: Record<string, number> = {};
  pendingOutboundBySource.forEach((value, key) => {
    if (value <= 0) {
      return;
    }
    next[key] = value;
  });
  return next;
};

const totalPendingOutbound = (): number => {
  let total = 0;
  pendingOutboundBySource.forEach((value) => {
    total += Math.max(0, Number.isFinite(value) ? value : 0);
  });
  return total;
};

const setSnapshot = (patch: Partial<RelayTransportJournalSnapshot>): void => {
  snapshot = {
    ...snapshot,
    ...patch,
    pendingOutboundCount: totalPendingOutbound(),
    pendingOutboundBySource: summarizePendingOutbound(),
    updatedAtUnixMs: Date.now(),
  };
  if (typeof window !== "undefined") {
    (window as Window & { obscurRelayTransportJournal?: unknown }).obscurRelayTransportJournal = {
      getSnapshot: relayTransportJournal.getSnapshot,
    };
  }
  emit();
};

export const relayTransportJournal = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): RelayTransportJournalSnapshot {
    return snapshot;
  },
  setSubscriptionState(params: Readonly<{
    desiredSubscriptionCount: number;
    pendingSubscriptionBatchCount: number;
  }>): void {
    setSnapshot({
      desiredSubscriptionCount: Math.max(0, Math.floor(params.desiredSubscriptionCount)),
      pendingSubscriptionBatchCount: Math.max(0, Math.floor(params.pendingSubscriptionBatchCount)),
    });
  },
  markSubscriptionReplayAttempt(params: Readonly<{
    reasonCode: RelaySubscriptionReplayReasonCode;
    detail?: string;
  }>): void {
    setSnapshot({
      lastSubscriptionReplayAttemptAtUnixMs: Date.now(),
      lastSubscriptionReplayReasonCode: params.reasonCode,
      lastSubscriptionReplayDetail: params.detail,
    });
  },
  markSubscriptionReplayResult(params: Readonly<{
    reasonCode?: RelaySubscriptionReplayReasonCode;
    result: RelaySubscriptionReplayResult;
    detail?: string;
  }>): void {
    setSnapshot({
      lastSubscriptionReplayResultAtUnixMs: Date.now(),
      lastSubscriptionReplayReasonCode: params.reasonCode ?? snapshot.lastSubscriptionReplayReasonCode,
      lastSubscriptionReplayResult: params.result,
      lastSubscriptionReplayDetail: params.detail,
    });
  },
  setPendingOutbound(source: string, count: number): void {
    const normalizedCount = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
    if (normalizedCount === 0) {
      pendingOutboundBySource.delete(source);
    } else {
      pendingOutboundBySource.set(source, normalizedCount);
    }
    setSnapshot({});
  },
  clearPendingOutbound(source: string): void {
    pendingOutboundBySource.delete(source);
    setSnapshot({});
  },
  resetForTests(): void {
    pendingOutboundBySource.clear();
    snapshot = createDefaultSnapshot();
    emit();
  },
};

