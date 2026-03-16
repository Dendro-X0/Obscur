"use client";

import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { createRelayWebSocket } from "@/app/features/relays/utils/create-relay-websocket";

const DEFAULT_DIRECT_QUERY_TIMEOUT_MS = 4_500;

const uniqueRelayUrls = (relayUrls: ReadonlyArray<string>): ReadonlyArray<string> => (
  Array.from(new Set(
    relayUrls
      .map((url) => url.trim())
      .filter((url) => url.length > 0)
      .filter((url) => !/^ws:\/\/localhost(?::\d+)?$/i.test(url))
  ))
);

const queryRelay = async (params: Readonly<{
  relayUrl: string;
  filters: ReadonlyArray<Record<string, unknown>>;
  matcher: (event: NostrEvent) => boolean;
  timeoutMs?: number;
}>): Promise<NostrEvent | null> => {
  const timeoutMs = params.timeoutMs ?? DEFAULT_DIRECT_QUERY_TIMEOUT_MS;
  return new Promise((resolve) => {
    const subId = `direct-query-${Math.random().toString(36).slice(2, 10)}`;
    let latestEvent: NostrEvent | null = null;
    let settled = false;
    const socket = createRelayWebSocket(params.relayUrl);

    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        socket.close();
      } catch {
        // Ignore cleanup errors during direct query fallback.
      }
      resolve(latestEvent);
    };

    const timeoutId = window.setTimeout(finish, timeoutMs);

    socket.onopen = () => {
      try {
        socket.send(JSON.stringify(["REQ", subId, ...params.filters]));
      } catch {
        clearTimeout(timeoutId);
        finish();
      }
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data);
        if (!Array.isArray(parsed) || parsed[1] !== subId) {
          return;
        }
        if (parsed[0] === "EVENT") {
          const nostrEvent = parsed[2] as NostrEvent;
          if (params.matcher(nostrEvent) && (!latestEvent || nostrEvent.created_at >= latestEvent.created_at)) {
            latestEvent = nostrEvent;
          }
        }
        if (parsed[0] === "EOSE") {
          clearTimeout(timeoutId);
          finish();
        }
      } catch {
        // Ignore malformed relay frames.
      }
    };

    socket.onerror = () => {
      clearTimeout(timeoutId);
      finish();
    };
    socket.onclose = () => {
      clearTimeout(timeoutId);
      finish();
    };
  });
};

export const fetchLatestEventFromRelayUrls = async (params: Readonly<{
  relayUrls: ReadonlyArray<string>;
  filters: ReadonlyArray<Record<string, unknown>>;
  matcher: (event: NostrEvent) => boolean;
  timeoutMs?: number;
}>): Promise<NostrEvent | null> => {
  const relayUrls = uniqueRelayUrls(params.relayUrls);
  let latestEvent: NostrEvent | null = null;
  for (const relayUrl of relayUrls) {
    const event = await queryRelay({
      relayUrl,
      filters: params.filters,
      matcher: params.matcher,
      timeoutMs: params.timeoutMs,
    });
    if (event && (!latestEvent || event.created_at >= latestEvent.created_at)) {
      latestEvent = event;
    }
  }
  return latestEvent;
};

export const directRelayQueryInternals = {
  queryRelay,
  uniqueRelayUrls,
};
