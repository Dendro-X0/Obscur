"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { windowRuntimeSupervisor } from "@/app/features/runtime/services/window-runtime-supervisor";
import { relayTransportJournal } from "@/app/features/relays/services/relay-transport-journal";

export type OutboundTransportKind =
  | "request"
  | "request_accept"
  | "request_decline"
  | "request_cancel"
  | "voice_invite"
  | "voice_signal"
  | "dm";
export type OutboundTransportQueueState = "queued" | "publishing" | "partial" | "published" | "terminal_failed";

export type OutboundTransportQueueItem = Readonly<{
  itemId: string;
  kind: OutboundTransportKind;
  peerPublicKeyHex?: string;
  eventId?: string;
  targetRelayUrls: ReadonlyArray<string>;
  requiredScope: "default" | "recipient_scope";
  attemptCount: number;
  lastAttemptAtUnixMs?: number;
  state: OutboundTransportQueueState;
  createdAtUnixMs: number;
  updatedAtUnixMs: number;
}>;

export type ProfileTransportQueueSnapshot = Readonly<{
  pendingCount: number;
  updatedAtUnixMs: number;
  items: ReadonlyArray<OutboundTransportQueueItem>;
}>;

export type QueueProcessorResult<T> = Readonly<{
  queueState: OutboundTransportQueueState;
  eventId?: string;
  targetRelayUrls?: ReadonlyArray<string>;
  output: T;
}>;

type QueueProcessor<T> = () => Promise<QueueProcessorResult<T>>;

type QueueListeners = Set<() => void>;

const HISTORY_LIMIT = 20;

const createStorageKey = (scopeKey: string): string => getScopedStorageKey(`obscur.transport_queue.v1.${scopeKey}`);

const createDefaultSnapshot = (): ProfileTransportQueueSnapshot => ({
  pendingCount: 0,
  updatedAtUnixMs: Date.now(),
  items: [],
});
const EMPTY_SNAPSHOT: ProfileTransportQueueSnapshot = createDefaultSnapshot();

const parseSnapshot = (raw: string | null): ProfileTransportQueueSnapshot => {
  if (!raw) {
    return createDefaultSnapshot();
  }
  try {
    const parsed = JSON.parse(raw) as ProfileTransportQueueSnapshot;
    if (!parsed || !Array.isArray(parsed.items)) {
      return createDefaultSnapshot();
    }
    return {
      pendingCount: typeof parsed.pendingCount === "number" ? parsed.pendingCount : 0,
      updatedAtUnixMs: typeof parsed.updatedAtUnixMs === "number" ? parsed.updatedAtUnixMs : Date.now(),
      items: parsed.items,
    };
  } catch {
    return createDefaultSnapshot();
  }
};

class ProfileTransportQueue {
  private snapshot: ProfileTransportQueueSnapshot;
  private listeners: QueueListeners = new Set();

  constructor(private readonly storageKey: string) {
    this.snapshot = typeof window === "undefined"
      ? createDefaultSnapshot()
      : parseSnapshot(window.localStorage.getItem(storageKey));
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): ProfileTransportQueueSnapshot => this.snapshot;

  async enqueue<T>(params: Readonly<{
    kind: OutboundTransportKind;
    peerPublicKeyHex?: string;
    requiredScope?: "default" | "recipient_scope";
    processor: QueueProcessor<T>;
  }>): Promise<T> {
    const itemId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `transport-${Date.now()}`;
    const baseItem: OutboundTransportQueueItem = {
      itemId,
      kind: params.kind,
      peerPublicKeyHex: params.peerPublicKeyHex,
      targetRelayUrls: [],
      requiredScope: params.requiredScope ?? "default",
      attemptCount: 0,
      state: "queued",
      createdAtUnixMs: Date.now(),
      updatedAtUnixMs: Date.now(),
    };

    this.upsertItem(baseItem);
    this.upsertItem({
      ...baseItem,
      state: "publishing",
      attemptCount: 1,
      lastAttemptAtUnixMs: Date.now(),
      updatedAtUnixMs: Date.now(),
    });

    try {
      const result = await params.processor();
      this.upsertItem({
        ...baseItem,
        state: result.queueState,
        eventId: result.eventId,
        targetRelayUrls: [...(result.targetRelayUrls ?? [])],
        attemptCount: 1,
        lastAttemptAtUnixMs: Date.now(),
        updatedAtUnixMs: Date.now(),
      });
      return result.output;
    } catch (error) {
      this.upsertItem({
        ...baseItem,
        state: "terminal_failed",
        attemptCount: 1,
        lastAttemptAtUnixMs: Date.now(),
        updatedAtUnixMs: Date.now(),
      });
      throw error;
    }
  }

  private upsertItem(nextItem: OutboundTransportQueueItem): void {
    const rest = this.snapshot.items.filter((item) => item.itemId !== nextItem.itemId);
    const items = [nextItem, ...rest].slice(0, HISTORY_LIMIT);
    this.setSnapshot({
      pendingCount: items.filter((item) => item.state === "queued" || item.state === "publishing").length,
      updatedAtUnixMs: Date.now(),
      items,
    });
  }

  private setSnapshot(next: ProfileTransportQueueSnapshot): void {
    this.snapshot = next;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(this.storageKey, JSON.stringify(next));
    }
    this.listeners.forEach((listener) => listener());
  }
}

const queuesByScopeKey = new Map<string, ProfileTransportQueue>();

export const getProfileTransportQueue = (scopeKey: string): ProfileTransportQueue => {
  const existing = queuesByScopeKey.get(scopeKey);
  if (existing) {
    return existing;
  }
  const created = new ProfileTransportQueue(createStorageKey(scopeKey));
  queuesByScopeKey.set(scopeKey, created);
  return created;
};

export const useProfileTransportQueue = (scopeKey: string | null) => {
  const queue = useMemo(() => (
    scopeKey ? getProfileTransportQueue(scopeKey) : null
  ), [scopeKey]);
  const snapshot = useSyncExternalStore(
    queue ? queue.subscribe : () => () => {},
    queue ? queue.getSnapshot : () => EMPTY_SNAPSHOT,
    () => EMPTY_SNAPSHOT
  );

  useEffect(() => {
    windowRuntimeSupervisor.syncTransportQueue({
      pendingCount: snapshot.pendingCount,
      updatedAtUnixMs: snapshot.updatedAtUnixMs,
    });
  }, [snapshot.pendingCount, snapshot.updatedAtUnixMs]);

  useEffect(() => {
    const source = `profile_transport_queue:${scopeKey ?? "none"}`;
    relayTransportJournal.setPendingOutbound(source, snapshot.pendingCount);
    return () => {
      relayTransportJournal.clearPendingOutbound(source);
    };
  }, [scopeKey, snapshot.pendingCount]);

  return useMemo(() => ({
    queue,
    snapshot,
    enqueue: async <T,>(params: Readonly<{
      kind: OutboundTransportKind;
      peerPublicKeyHex?: string;
      requiredScope?: "default" | "recipient_scope";
      processor: QueueProcessor<T>;
    }>): Promise<T> => {
      if (!queue) {
        return params.processor().then((result) => result.output);
      }
      return queue.enqueue(params);
    },
  }), [queue, snapshot]);
};
