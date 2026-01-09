import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { createNostrEvent } from "@dweb/nostr/create-nostr-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { RelayConnection } from "../relay-connection";

type RelayPool = Readonly<{
  connections: ReadonlyArray<RelayConnection>;
  sendToOpen: (payload: string) => void;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
}>;

type GroupMetadata = Readonly<{
  name: string | null;
  about: string | null;
  picture: string | null;
  isPrivate: boolean;
  isClosed: boolean;
  isRestricted: boolean;
  isHidden: boolean;
}>;

type MembershipState = Readonly<{
  status: "unknown" | "member" | "not_member";
  decidedByEventId?: string;
  decidedByKind?: 9000 | 9001;
}>;

type RelayFeedback = Readonly<{
  lastNotice?: string;
  lastOk?: Readonly<{ eventId: string; accepted: boolean; message: string }>;
}>;

type Nip29GroupState = Readonly<{
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  relayUrl: string;
  groupId: string;
  metadata: GroupMetadata | null;
  messages: ReadonlyArray<NostrEvent>;
  membership: MembershipState;
  relayFeedback: RelayFeedback;
}>;

type UseNip29GroupParams = Readonly<{
  pool: RelayPool;
  relayUrl: string;
  groupId: string;
  myPublicKeyHex: PublicKeyHex | null;
  myPrivateKeyHex: PrivateKeyHex | null;
}>;

type UseNip29GroupResult = Readonly<{
  state: Nip29GroupState;
  refresh: () => void;
  requestJoin: (params?: Readonly<{ reason?: string; inviteCode?: string }>) => Promise<void>;
  sendMessage: (params: Readonly<{ content: string }>) => Promise<void>;
}>;

const createSubId = (): string => {
  const bytes: Uint8Array = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b: number) => b.toString(16).padStart(2, "0")).join("");
};

const parseIncomingEvent = (value: unknown): NostrEvent | null => {
  if (!Array.isArray(value) || value.length < 3) {
    return null;
  }
  if (value[0] !== "EVENT") {
    return null;
  }
  const eventCandidate: unknown = value[2];
  if (typeof eventCandidate !== "object" || eventCandidate === null) {
    return null;
  }
  const event: Record<string, unknown> = eventCandidate as Record<string, unknown>;
  if (typeof event.id !== "string") {
    return null;
  }
  if (typeof event.pubkey !== "string") {
    return null;
  }
  if (typeof event.created_at !== "number") {
    return null;
  }
  if (typeof event.kind !== "number") {
    return null;
  }
  if (!Array.isArray(event.tags)) {
    return null;
  }
  if (typeof event.content !== "string") {
    return null;
  }
  if (typeof event.sig !== "string") {
    return null;
  }
  const tags: ReadonlyArray<ReadonlyArray<string>> = (event.tags as ReadonlyArray<unknown>)
    .filter((tag: unknown): tag is ReadonlyArray<unknown> => Array.isArray(tag))
    .map((tag: ReadonlyArray<unknown>) => tag.filter((item: unknown): item is string => typeof item === "string"));
  return { id: event.id, pubkey: event.pubkey, created_at: event.created_at, kind: event.kind, tags, content: event.content, sig: event.sig };
};

const uniqByIdNewestFirst = (events: ReadonlyArray<NostrEvent>): ReadonlyArray<NostrEvent> => {
  const map: Map<string, NostrEvent> = new Map();
  events.forEach((e: NostrEvent): void => {
    if (!map.has(e.id)) {
      map.set(e.id, e);
    }
  });
  return Array.from(map.values()).sort((a: NostrEvent, b: NostrEvent) => b.created_at - a.created_at);
};

const getTagValue = (tags: ReadonlyArray<ReadonlyArray<string>>, name: string): string | null => {
  const found: ReadonlyArray<string> | undefined = tags.find((tag: ReadonlyArray<string>) => tag.length >= 2 && tag[0] === name);
  if (!found) {
    return null;
  }
  return found[1] ?? null;
};

const hasTag = (tags: ReadonlyArray<ReadonlyArray<string>>, name: string): boolean => {
  return tags.some((tag: ReadonlyArray<string>) => tag.length >= 1 && tag[0] === name);
};

const parseMetadataEvent = (event: NostrEvent, groupId: string): GroupMetadata | null => {
  if (event.kind !== 39000) {
    return null;
  }
  const d: string | null = getTagValue(event.tags, "d");
  if (!d || d !== groupId) {
    return null;
  }
  return {
    name: getTagValue(event.tags, "name"),
    about: getTagValue(event.tags, "about"),
    picture: getTagValue(event.tags, "picture"),
    isPrivate: hasTag(event.tags, "private"),
    isClosed: hasTag(event.tags, "closed"),
    isRestricted: hasTag(event.tags, "restricted"),
    isHidden: hasTag(event.tags, "hidden"),
  };
};

type RelayOkMessage = Readonly<{ eventId: string; accepted: boolean; message: string }>;

const parseRelayOkMessage = (value: unknown): RelayOkMessage | null => {
  if (!Array.isArray(value) || value.length < 4) {
    return null;
  }
  if (value[0] !== "OK") {
    return null;
  }
  const eventId: unknown = value[1];
  const accepted: unknown = value[2];
  const message: unknown = value[3];
  if (typeof eventId !== "string" || typeof accepted !== "boolean" || typeof message !== "string") {
    return null;
  }
  return { eventId, accepted, message };
};

type RelayNoticeMessage = Readonly<{ message: string }>;

const parseRelayNoticeMessage = (value: unknown): RelayNoticeMessage | null => {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }
  if (value[0] !== "NOTICE") {
    return null;
  }
  const message: unknown = value[1];
  if (typeof message !== "string") {
    return null;
  }
  return { message };
};

type MembershipDecision = Readonly<{ kind: 9000 | 9001; eventId: string }>;

const decideMembership = (events: ReadonlyArray<NostrEvent>, groupId: string, myPublicKeyHex: PublicKeyHex): MembershipDecision | null => {
  const relevant: ReadonlyArray<NostrEvent> = events
    .filter((e: NostrEvent): boolean => e.kind === 9000 || e.kind === 9001)
    .filter((e: NostrEvent): boolean => e.tags.some((t: ReadonlyArray<string>) => t[0] === "h" && t[1] === groupId))
    .filter((e: NostrEvent): boolean => e.tags.some((t: ReadonlyArray<string>) => t[0] === "p" && t[1] === myPublicKeyHex));
  if (relevant.length === 0) {
    return null;
  }
  const newest: NostrEvent = relevant.reduce((acc: NostrEvent, next: NostrEvent): NostrEvent => (next.created_at > acc.created_at ? next : acc));
  return { kind: newest.kind as 9000 | 9001, eventId: newest.id };
};

const selectPreviousRefs = (params: Readonly<{ events: ReadonlyArray<NostrEvent>; myPublicKeyHex: PublicKeyHex | null; max: number }>): ReadonlyArray<string> => {
  const filtered: ReadonlyArray<NostrEvent> = params.events.filter((e: NostrEvent): boolean => {
    if (!params.myPublicKeyHex) {
      return true;
    }
    return e.pubkey !== params.myPublicKeyHex;
  });
  const refs: ReadonlyArray<string> = filtered
    .slice(0, 50)
    .map((e: NostrEvent): string => e.id.slice(0, 8))
    .filter((id: string): boolean => id.length === 8);
  return Array.from(new Set(refs)).slice(0, params.max);
};

export const useNip29Group = (params: UseNip29GroupParams): UseNip29GroupResult => {
  const [state, setState] = useState<Nip29GroupState>({
    status: "idle",
    relayUrl: params.relayUrl,
    groupId: params.groupId,
    metadata: null,
    messages: [],
    membership: { status: "unknown" },
    relayFeedback: {},
  });
  const metadataSubId: string = useMemo((): string => createSubId(), []);
  const messagesSubId: string = useMemo((): string => createSubId(), []);
  const membershipSubId: string = useMemo((): string => createSubId(), []);
  const hasRequestedRef = useRef<boolean>(false);
  const allEventsRef = useRef<ReadonlyArray<NostrEvent>>([]);
  useEffect((): (() => void) => {
    return params.pool.subscribeToMessages((evt: Readonly<{ url: string; message: string }>): void => {
      if (evt.url !== params.relayUrl) {
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(evt.message);
      } catch {
        return;
      }
      const ok: RelayOkMessage | null = parseRelayOkMessage(parsed);
      if (ok) {
        setState((prev: Nip29GroupState): Nip29GroupState => ({
          ...prev,
          relayFeedback: { ...prev.relayFeedback, lastOk: ok },
        }));
        return;
      }
      const notice: RelayNoticeMessage | null = parseRelayNoticeMessage(parsed);
      if (notice) {
        setState((prev: Nip29GroupState): Nip29GroupState => ({
          ...prev,
          relayFeedback: { ...prev.relayFeedback, lastNotice: notice.message },
        }));
        return;
      }
      const event: NostrEvent | null = parseIncomingEvent(parsed);
      if (!event) {
        return;
      }
      allEventsRef.current = uniqByIdNewestFirst([event, ...allEventsRef.current]).slice(0, 300);
      const nextMetadata: GroupMetadata | null = parseMetadataEvent(event, params.groupId);
      if (nextMetadata) {
        setState((prev: Nip29GroupState): Nip29GroupState => ({
          ...prev,
          status: "ready",
          metadata: nextMetadata,
        }));
        return;
      }
      const isGroupScoped: boolean = event.tags.some((t: ReadonlyArray<string>) => t[0] === "h" && t[1] === params.groupId);
      if (!isGroupScoped) {
        return;
      }
      if (params.myPublicKeyHex) {
        const decision: MembershipDecision | null = decideMembership(allEventsRef.current, params.groupId, params.myPublicKeyHex);
        if (decision) {
          setState((prev: Nip29GroupState): Nip29GroupState => ({
            ...prev,
            membership: {
              status: decision.kind === 9000 ? "member" : "not_member",
              decidedByEventId: decision.eventId,
              decidedByKind: decision.kind,
            },
          }));
        }
      }
      if (event.kind !== 1) {
        return;
      }
      setState((prev: Nip29GroupState): Nip29GroupState => ({
        ...prev,
        status: prev.status === "idle" ? "ready" : prev.status,
        messages: uniqByIdNewestFirst([event, ...prev.messages]).slice(0, 100),
      }));
    });
  }, [params.groupId, params.myPublicKeyHex, params.pool, params.relayUrl]);
  const request = useCallback((): void => {
    if (hasRequestedRef.current) {
      return;
    }
    const hasOpen: boolean = params.pool.connections.some((c: RelayConnection): boolean => c.url === params.relayUrl && c.status === "open");
    if (!hasOpen) {
      setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, status: prev.status === "idle" ? "loading" : prev.status }));
      return;
    }
    hasRequestedRef.current = true;
    setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, status: "loading" }));
    const metadataFilter: string = JSON.stringify(["REQ", metadataSubId, { kinds: [39000, 39001, 39002, 39003], "#d": [params.groupId], limit: 10 }]);
    params.pool.sendToOpen(metadataFilter);
    const messageFilter: string = JSON.stringify(["REQ", messagesSubId, { kinds: [1], "#h": [params.groupId], limit: 50 }]);
    params.pool.sendToOpen(messageFilter);
    if (params.myPublicKeyHex) {
      const membershipFilter: string = JSON.stringify(["REQ", membershipSubId, { kinds: [9000, 9001], "#h": [params.groupId], "#p": [params.myPublicKeyHex], limit: 10 }]);
      params.pool.sendToOpen(membershipFilter);
    }
  }, [membershipSubId, metadataSubId, messagesSubId, params.groupId, params.myPublicKeyHex, params.pool, params.relayUrl]);
  useEffect((): void => {
    queueMicrotask((): void => {
      request();
    });
  }, [request]);
  const refresh = useCallback((): void => {
    hasRequestedRef.current = false;
    request();
  }, [request]);
  const requestJoin = useCallback(
    async (joinParams?: Readonly<{ reason?: string; inviteCode?: string }>): Promise<void> => {
      if (!params.myPrivateKeyHex || !params.myPublicKeyHex) {
        setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, status: "error", error: "Identity must be unlocked to request join." }));
        return;
      }
      const tags: ReadonlyArray<ReadonlyArray<string>> = joinParams?.inviteCode
        ? [["h", params.groupId], ["code", joinParams.inviteCode]]
        : [["h", params.groupId]];
      const content: string = (joinParams?.reason ?? "").trim();
      const event: NostrEvent = await createNostrEvent({ privateKeyHex: params.myPrivateKeyHex, kind: 9021, content, tags });
      params.pool.sendToOpen(JSON.stringify(["EVENT", event]));
      setState((prev: Nip29GroupState): Nip29GroupState => ({
        ...prev,
        relayFeedback: { ...prev.relayFeedback, lastOk: undefined },
      }));
    },
    [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, params.pool]
  );
  const sendMessage = useCallback(
    async (sendParams: Readonly<{ content: string }>): Promise<void> => {
      if (!params.myPrivateKeyHex || !params.myPublicKeyHex) {
        setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, status: "error", error: "Identity must be unlocked to send messages." }));
        return;
      }
      const content: string = sendParams.content.trim();
      if (!content) {
        return;
      }
      const previous: ReadonlyArray<string> = selectPreviousRefs({ events: allEventsRef.current, myPublicKeyHex: params.myPublicKeyHex, max: 3 });
      const tags: ReadonlyArray<ReadonlyArray<string>> = previous.length > 0 ? [["h", params.groupId], ["previous", ...previous]] : [["h", params.groupId]];
      const event: NostrEvent = await createNostrEvent({ privateKeyHex: params.myPrivateKeyHex, kind: 1, content, tags });
      params.pool.sendToOpen(JSON.stringify(["EVENT", event]));
      setState((prev: Nip29GroupState): Nip29GroupState => ({
        ...prev,
        relayFeedback: { ...prev.relayFeedback, lastOk: undefined },
      }));
    },
    [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, params.pool]
  );
  useEffect((): void => {
    queueMicrotask((): void => {
      setState((prev: Nip29GroupState): Nip29GroupState => ({
        ...prev,
        relayUrl: params.relayUrl,
        groupId: params.groupId,
        error: undefined,
      }));
    });
  }, [params.groupId, params.relayUrl]);
  return { state, refresh, requestJoin, sendMessage };
};
