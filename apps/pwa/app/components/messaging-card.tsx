"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { createNostrEvent } from "@dweb/nostr/create-nostr-event";
import { fetchBootstrapConfig } from "../lib/fetch-bootstrap-config";
import { useIdentity } from "../lib/use-identity";
import { useRelayPool } from "../lib/use-relay-pool";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

type RelayFeedback = Readonly<{
  url: string;
  eose: boolean;
  lastNotice?: string;
  lastOk?: Readonly<{
    eventId: string;
    accepted: boolean;
    message: string;
  }>;
}>;

type MessagingViewState = Readonly<{
  relayUrls: ReadonlyArray<string>;
  relayFeedback: ReadonlyArray<RelayFeedback>;
  events: ReadonlyArray<NostrEvent>;
  status: "loading" | "ready" | "error";
  error?: string;
}>;

const createLoadingState = (): MessagingViewState => ({ relayUrls: [], relayFeedback: [], events: [], status: "loading" });

const createErrorState = (message: string): MessagingViewState => ({ relayUrls: [], relayFeedback: [], events: [], status: "error", error: message });

const createReadyState = (params: Readonly<{ relayUrls: ReadonlyArray<string>; relayFeedback: ReadonlyArray<RelayFeedback>; events: ReadonlyArray<NostrEvent> }>): MessagingViewState => ({
  relayUrls: params.relayUrls,
  relayFeedback: params.relayFeedback,
  events: params.events,
  status: "ready"
});

const createRelayFeedback = (url: string): RelayFeedback => ({
  url,
  eose: false
});

const createSubId = (): string => {
  const bytes: Uint8Array = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
};

const parseIncomingEvent = (value: unknown): NostrEvent | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  if (value.length < 3) {
    return undefined;
  }
  if (value[0] !== "EVENT") {
    return undefined;
  }
  const eventCandidate: unknown = value[2];
  if (typeof eventCandidate !== "object" || eventCandidate === null) {
    return undefined;
  }
  const event: Record<string, unknown> = eventCandidate as Record<string, unknown>;
  if (typeof event.id !== "string") {
    return undefined;
  }
  if (typeof event.pubkey !== "string") {
    return undefined;
  }
  if (typeof event.created_at !== "number") {
    return undefined;
  }
  if (typeof event.kind !== "number") {
    return undefined;
  }
  if (!Array.isArray(event.tags)) {
    return undefined;
  }
  if (typeof event.content !== "string") {
    return undefined;
  }
  if (typeof event.sig !== "string") {
    return undefined;
  }
  const tags: ReadonlyArray<ReadonlyArray<string>> = event.tags
    .filter((tag: unknown): tag is ReadonlyArray<unknown> => Array.isArray(tag))
    .map((tag: ReadonlyArray<unknown>) => tag.filter((item: unknown): item is string => typeof item === "string"));
  return { id: event.id, pubkey: event.pubkey, created_at: event.created_at, kind: event.kind, tags, content: event.content, sig: event.sig };
};

const uniqByIdNewestFirst = (events: ReadonlyArray<NostrEvent>): ReadonlyArray<NostrEvent> => {
  const map: Map<string, NostrEvent> = new Map();
  events.forEach((e: NostrEvent) => {
    if (!map.has(e.id)) {
      map.set(e.id, e);
    }
  });
  return Array.from(map.values()).sort((a: NostrEvent, b: NostrEvent) => b.created_at - a.created_at);
};

type RelayMessage =
  | Readonly<{ kind: "event"; event: NostrEvent }>
  | Readonly<{ kind: "eose"; subscriptionId: string }>
  | Readonly<{ kind: "notice"; message: string }>
  | Readonly<{ kind: "ok"; eventId: string; accepted: boolean; message: string }>;

const parseRelayMessage = (rawJson: string): RelayMessage | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return undefined;
  }
  const event: NostrEvent | undefined = parseIncomingEvent(parsed);
  if (event) {
    return { kind: "event", event };
  }
  if (!Array.isArray(parsed) || parsed.length < 2) {
    return undefined;
  }
  const kind: unknown = parsed[0];
  if (kind === "EOSE" && typeof parsed[1] === "string") {
    return { kind: "eose", subscriptionId: parsed[1] };
  }
  if (kind === "NOTICE" && typeof parsed[1] === "string") {
    return { kind: "notice", message: parsed[1] };
  }
  if (kind === "OK" && typeof parsed[1] === "string" && typeof parsed[2] === "boolean" && typeof parsed[3] === "string") {
    return { kind: "ok", eventId: parsed[1], accepted: parsed[2], message: parsed[3] };
  }
  return undefined;
};

export const MessagingCard = () => {
  const identity = useIdentity();
  const [state, setState] = useState<MessagingViewState>(createLoadingState());
  const subId: string = useMemo(() => createSubId(), []);
  const [content, setContent] = useState<string>("hello from dweb");
  const canPublish: boolean = useMemo(() => identity.state.status === "unlocked" && Boolean(identity.state.privateKeyHex) && content.trim().length > 0, [content, identity.state.privateKeyHex, identity.state.status]);
  const { connections, sendToOpen, subscribeToMessages } = useRelayPool(state.relayUrls);
  const hasRequestedRef = useRef<boolean>(false);

  useEffect(() => {
    const run = async (): Promise<void> => {
      try {
        const result: Awaited<ReturnType<typeof fetchBootstrapConfig>> = await fetchBootstrapConfig();
        if (result.error) {
          setState(createErrorState(result.error));
          return;
        }
        const relayUrls: ReadonlyArray<string> = result.data?.relays ?? [];
        const relayFeedback: ReadonlyArray<RelayFeedback> = relayUrls.map((url: string) => createRelayFeedback(url));
        setState(createReadyState({ relayUrls, relayFeedback, events: [] }));
      } catch (error: unknown) {
        const message: string = error instanceof Error ? error.message : "Unknown error";
        setState(createErrorState(message));
      }
    };
    void run();
  }, []);

  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }
    const unsubscribe: () => void = subscribeToMessages((params: Readonly<{ url: string; message: string }>) => {
      const message: RelayMessage | undefined = parseRelayMessage(params.message);
      if (!message) {
        return;
      }
      if (message.kind === "event") {
        setState((prev: MessagingViewState) => {
          if (prev.status !== "ready") {
            return prev;
          }
          const events: ReadonlyArray<NostrEvent> = uniqByIdNewestFirst([message.event, ...prev.events]).slice(0, 50);
          return createReadyState({ relayUrls: prev.relayUrls, relayFeedback: prev.relayFeedback, events });
        });
        return;
      }
      if (message.kind === "eose" && message.subscriptionId === subId) {
        setState((prev: MessagingViewState) => {
          if (prev.status !== "ready") {
            return prev;
          }
          const relayFeedback: ReadonlyArray<RelayFeedback> = prev.relayFeedback.map((r: RelayFeedback) => (r.url === params.url ? { ...r, eose: true } : r));
          return createReadyState({ relayUrls: prev.relayUrls, relayFeedback, events: prev.events });
        });
        return;
      }
      if (message.kind === "notice") {
        setState((prev: MessagingViewState) => {
          if (prev.status !== "ready") {
            return prev;
          }
          const relayFeedback: ReadonlyArray<RelayFeedback> = prev.relayFeedback.map((r: RelayFeedback) => (r.url === params.url ? { ...r, lastNotice: message.message } : r));
          return createReadyState({ relayUrls: prev.relayUrls, relayFeedback, events: prev.events });
        });
        return;
      }
      if (message.kind === "ok") {
        setState((prev: MessagingViewState) => {
          if (prev.status !== "ready") {
            return prev;
          }
          const relayFeedback: ReadonlyArray<RelayFeedback> = prev.relayFeedback.map((r: RelayFeedback) =>
            r.url === params.url ? { ...r, lastOk: { eventId: message.eventId, accepted: message.accepted, message: message.message } } : r
          );
          return createReadyState({ relayUrls: prev.relayUrls, relayFeedback, events: prev.events });
        });
      }
    });
    return () => {
      unsubscribe();
    };
  }, [state.status, subscribeToMessages, subId]);

  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }
    if (hasRequestedRef.current) {
      return;
    }
    const hasOpen: boolean = connections.some((connection) => connection.status === "open");
    if (!hasOpen) {
      return;
    }
    hasRequestedRef.current = true;
    sendToOpen(JSON.stringify(["REQ", subId, { kinds: [1], limit: 20 }]));
  }, [connections, sendToOpen, state.status, subId]);

  const publish = async (): Promise<void> => {
    if (identity.state.status !== "unlocked" || !identity.state.privateKeyHex) {
      return;
    }
    if (!content.trim()) {
      return;
    }
    const event: NostrEvent = await createNostrEvent({ privateKeyHex: identity.state.privateKeyHex, kind: 1, content: content.trim() });
    const payload: string = JSON.stringify(["EVENT", event]);
    sendToOpen(payload);
  };

  if (state.status === "loading") {
    return (
      <Card title="Messaging" description="Public notes (kind:1) and relay feedback.">
        <div>Loading…</div>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card tone="danger" title="Messaging" description="Public notes (kind:1) and relay feedback.">
        <div className="wrap-break-word">{state.error}</div>
      </Card>
    );
  }

  return (
    <Card title="Messaging" description="Public notes (kind:1) and relay feedback.">
      <div>
        <Label>Publish note (kind:1)</Label>
        <Input value={content} onChange={(e) => setContent(e.target.value)} type="text" placeholder="Type a note" />
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" onClick={() => void publish()} disabled={!canPublish}>
          Publish
        </Button>
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          Identity: <span className="font-medium text-zinc-900 dark:text-zinc-100">{identity.state.status}</span>
        </div>
      </div>
      <div className="mt-5">
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Relays</div>
        <ul className="mt-2 space-y-2">
          {connections.map((relay) => {
            const feedback: RelayFeedback | undefined = state.relayFeedback.find((r: RelayFeedback) => r.url === relay.url);
            return (
              <li key={relay.url} className="flex flex-col gap-1 rounded-xl border border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-zinc-950/60">
                <div className="font-mono text-xs wrap-break-word">{relay.url}</div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  Status: <span className="font-medium text-zinc-900 dark:text-zinc-100">{relay.status}</span>
                </div>
                {feedback?.eose ? <div className="text-xs text-zinc-600 dark:text-zinc-400">Synced: yes</div> : <div className="text-xs text-zinc-600 dark:text-zinc-400">Synced: no</div>}
                {feedback?.lastOk ? (
                  <div className={feedback.lastOk.accepted ? "text-xs text-emerald-700 wrap-break-word dark:text-emerald-300" : "text-xs text-red-700 wrap-break-word dark:text-red-300"}>
                    OK({feedback.lastOk.accepted ? "accepted" : "rejected"}): {feedback.lastOk.message}
                  </div>
                ) : null}
                {feedback?.lastNotice ? <div className="text-xs text-amber-700 wrap-break-word dark:text-amber-300">NOTICE: {feedback.lastNotice}</div> : null}
                {relay.errorMessage ? <div className="text-xs text-red-700 wrap-break-word dark:text-red-300">{relay.errorMessage}</div> : null}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="mt-5">
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Recent notes</div>
        <ul className="mt-2 space-y-2">
          {state.events.length === 0 ? <li className="text-xs text-zinc-600 dark:text-zinc-400">No events yet.</li> : null}
          {state.events.slice(0, 10).map((event: NostrEvent) => (
            <li key={event.id} className="flex flex-col gap-1 rounded-xl border border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-zinc-950/60">
              <div className="text-xs text-zinc-600 dark:text-zinc-400 font-mono wrap-break-word">{event.id}</div>
              <div className="text-sm wrap-break-word">{event.content}</div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
};
