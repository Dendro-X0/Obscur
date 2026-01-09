import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createNostrDmEvent } from "@dweb/nostr/create-nostr-dm-event";
import { nip04Decrypt } from "@dweb/nostr/nip04-decrypt";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { RelayConnection } from "../relay-connection";
import { parsePublicKeyInput } from "../parse-public-key-input";
import { NOSTR_SAFETY_LIMITS } from "../nostr-safety-limits";

type RelayPool = Readonly<{
  connections: ReadonlyArray<RelayConnection>;
  sendToOpen: (payload: string) => void;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
}>;

type DmMessage = Readonly<{
  id: string;
  peerPublicKeyHex: PublicKeyHex;
  createdAtUnixSeconds: number;
  plaintext: string;
  direction: "incoming" | "outgoing";
  deliveryStatus?: "delivered" | "sending" | "accepted" | "rejected";
}>;

type DmControllerState = Readonly<{
  status: "idle" | "ready" | "error";
  error?: string;
  messages: ReadonlyArray<DmMessage>;
}>;

type UseDmControllerParams = Readonly<{
  myPublicKeyHex: PublicKeyHex | null;
  myPrivateKeyHex: PrivateKeyHex | null;
  pool: RelayPool;
}>;

type UseDmControllerResult = Readonly<{
  state: DmControllerState;
  ensureSubscribed: () => void;
  sendDm: (params: Readonly<{ peerPublicKeyInput: string; plaintext: string }>) => Promise<Readonly<{ id: string; createdAtUnixSeconds: number }>>;
}>;

const MAX_MESSAGES: number = 200;

const createInitialState = (): DmControllerState => ({ status: "idle", messages: [] });

const createErrorState = (message: string): DmControllerState => ({ status: "error", error: message, messages: [] });

const createReadyState = (messages: ReadonlyArray<DmMessage>): DmControllerState => ({ status: "ready", messages });

const createSubId = (): string => {
  const bytes: Uint8Array = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b: number) => b.toString(16).padStart(2, "0")).join("");
};

type RelayOkMessage = Readonly<{ eventId: string; ok: boolean }>;

const parseRelayOkMessage = (payload: string): RelayOkMessage | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length < 3) {
    return null;
  }
  if (parsed[0] !== "OK") {
    return null;
  }
  const eventId: unknown = parsed[1];
  const ok: unknown = parsed[2];
  if (typeof eventId !== "string" || typeof ok !== "boolean") {
    return null;
  }
  return { eventId, ok };
};

const getTagValue = (tags: ReadonlyArray<ReadonlyArray<string>>, name: string): string | null => {
  const found: ReadonlyArray<string> | undefined = tags.find((tag: ReadonlyArray<string>) => tag.length >= 2 && tag[0] === name);
  if (!found) {
    return null;
  }
  const value: string | undefined = found[1];
  return value ?? null;
};

const isKind4Event = (candidate: unknown): candidate is NostrEvent => {
  if (typeof candidate !== "object" || candidate === null) {
    return false;
  }
  const record: Record<string, unknown> = candidate as Record<string, unknown>;
  return typeof record.kind === "number" && record.kind === 4;
};

const parseRelayEventMessage = (payload: string): NostrEvent | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length < 3) {
    return null;
  }
  if (parsed[0] !== "EVENT") {
    return null;
  }
  const eventCandidate: unknown = parsed[2];
  if (!isKind4Event(eventCandidate)) {
    return null;
  }
  return eventCandidate;
};

const uniqByIdNewestFirst = (items: ReadonlyArray<DmMessage>): ReadonlyArray<DmMessage> => {
  const map: Map<string, DmMessage> = new Map();
  items.forEach((item: DmMessage): void => {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values()).sort((a: DmMessage, b: DmMessage) => b.createdAtUnixSeconds - a.createdAtUnixSeconds);
};

export const useDmController = (params: UseDmControllerParams): UseDmControllerResult => {
  const [state, setState] = useState<DmControllerState>(createInitialState);
  const subId: string = useMemo((): string => createSubId(), []);
  const hasRequestedRef = useRef<boolean>(false);
  const hasListenersRef = useRef<boolean>(false);
  useEffect((): (() => void) | void => {
    if (hasListenersRef.current) {
      return;
    }
    hasListenersRef.current = true;
    const unsubscribe: () => void = params.pool.subscribeToMessages((evt: Readonly<{ url: string; message: string }>): void => {
      void evt;
      const ok: RelayOkMessage | null = parseRelayOkMessage(evt.message);
      if (ok) {
        setState((prev: DmControllerState): DmControllerState => {
          const next: ReadonlyArray<DmMessage> = prev.messages.map((m: DmMessage): DmMessage => {
            if (m.direction !== "outgoing" || m.id !== ok.eventId) {
              return m;
            }
            const deliveryStatus: "accepted" | "rejected" = ok.ok ? "accepted" : "rejected";
            if (m.deliveryStatus === deliveryStatus) {
              return m;
            }
            return { ...m, deliveryStatus };
          });
          return createReadyState(next);
        });
        return;
      }
      const event: NostrEvent | null = parseRelayEventMessage(evt.message);
      if (!event) {
        return;
      }
      if (!params.myPublicKeyHex || !params.myPrivateKeyHex) {
        return;
      }
      if (!Array.isArray(event.tags)) {
        return;
      }
      const tags: ReadonlyArray<ReadonlyArray<string>> = event.tags.map((tag: ReadonlyArray<string>): ReadonlyArray<string> => tag);
      const recipient: string | null = getTagValue(tags, "p");
      if (!recipient || recipient !== params.myPublicKeyHex) {
        return;
      }
      const senderPublicKeyHex: PublicKeyHex = event.pubkey as PublicKeyHex;
      void nip04Decrypt({ recipientPrivateKeyHex: params.myPrivateKeyHex, senderPublicKeyHex, payload: event.content })
        .then((plaintext: string): void => {
          const nextMessage: DmMessage = {
            id: event.id,
            peerPublicKeyHex: senderPublicKeyHex,
            createdAtUnixSeconds: event.created_at,
            plaintext,
            direction: "incoming",
            deliveryStatus: "delivered",
          };
          setState((prev: DmControllerState): DmControllerState => {
            const next: ReadonlyArray<DmMessage> = uniqByIdNewestFirst([nextMessage, ...prev.messages]).slice(0, MAX_MESSAGES);
            return createReadyState(next);
          });
        })
        .catch((): void => {
          return;
        });
    });
    return (): void => {
      unsubscribe();
    };
  }, [params.myPrivateKeyHex, params.myPublicKeyHex, params.pool, subId]);
  const ensureSubscribed = useCallback((): void => {
    if (!params.myPublicKeyHex) {
      return;
    }
    if (hasRequestedRef.current) {
      return;
    }
    const hasOpen: boolean = params.pool.connections.some((connection: RelayConnection): boolean => connection.status === "open");
    if (!hasOpen) {
      return;
    }
    hasRequestedRef.current = true;
    params.pool.sendToOpen(JSON.stringify(["REQ", subId, { kinds: [4], "#p": [params.myPublicKeyHex], limit: 50 }]));
  }, [params.myPublicKeyHex, params.pool, subId]);
  useEffect((): void => {
    ensureSubscribed();
  }, [ensureSubscribed]);
  const sendDm = async (sendParams: Readonly<{ peerPublicKeyInput: string; plaintext: string }>): Promise<Readonly<{ id: string; createdAtUnixSeconds: number }>> => {
    if (!params.myPrivateKeyHex || !params.myPublicKeyHex) {
      setState(createErrorState("Identity must be unlocked to send messages."));
      return { id: "", createdAtUnixSeconds: 0 };
    }
    const parsed = parsePublicKeyInput(sendParams.peerPublicKeyInput);
    if (!parsed.ok) {
      setState(createErrorState("Invalid recipient public key."));
      return { id: "", createdAtUnixSeconds: 0 };
    }
    const plaintext: string = sendParams.plaintext.trim();
    if (plaintext.length === 0) {
      return { id: "", createdAtUnixSeconds: 0 };
    }
    if (plaintext.length > NOSTR_SAFETY_LIMITS.maxDmPlaintextChars) {
      setState(createErrorState(`Message is too long (max ${NOSTR_SAFETY_LIMITS.maxDmPlaintextChars} chars).`));
      return { id: "", createdAtUnixSeconds: 0 };
    }
    const event: NostrEvent = await createNostrDmEvent({ senderPrivateKeyHex: params.myPrivateKeyHex, recipientPublicKeyHex: parsed.publicKeyHex, plaintext });
    params.pool.sendToOpen(JSON.stringify(["EVENT", event]));
    const nextMessage: DmMessage = { id: event.id, peerPublicKeyHex: parsed.publicKeyHex, createdAtUnixSeconds: event.created_at, plaintext, direction: "outgoing", deliveryStatus: "sending" };
    setState((prev: DmControllerState): DmControllerState => {
      const next: ReadonlyArray<DmMessage> = uniqByIdNewestFirst([nextMessage, ...prev.messages]).slice(0, MAX_MESSAGES);
      return createReadyState(next);
    });
    return { id: event.id, createdAtUnixSeconds: event.created_at };
  };
  return { state, ensureSubscribed, sendDm };
};
