"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { createNostrDmEvent } from "@dweb/nostr/create-nostr-dm-event";
import { nip04Decrypt } from "@dweb/nostr/nip04-decrypt";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { fetchBootstrapConfig } from "../lib/fetch-bootstrap-config";
import { useIdentity } from "../lib/use-identity";
import { useRelayPool } from "../lib/use-relay-pool";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

type DecryptedDm = Readonly<{
  id: string;
  senderPublicKeyHex: string;
  recipientPublicKeyHex: string;
  createdAtUnixSeconds: number;
  plaintext: string;
}>;

type DirectMessagesState = Readonly<{
  status: "loading" | "ready" | "error";
  relayUrls: ReadonlyArray<string>;
  error?: string;
  dms: ReadonlyArray<DecryptedDm>;
}>;

const createInitialState = (): DirectMessagesState => ({ status: "loading", relayUrls: [], dms: [] });

const createErrorState = (message: string): DirectMessagesState => ({ status: "error", relayUrls: [], dms: [], error: message });

const createReadyState = (params: Readonly<{ relayUrls: ReadonlyArray<string>; dms: ReadonlyArray<DecryptedDm> }>): DirectMessagesState => ({ status: "ready", relayUrls: params.relayUrls, dms: params.dms });

const createSubId = (): string => {
  const bytes: Uint8Array = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
};

const isPublicKeyHex = (value: string): value is PublicKeyHex => {
  const normalized: string = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(normalized);
};

const isPrivateKeyHex = (value: string): value is PrivateKeyHex => {
  const normalized: string = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(normalized);
};

const getTagValue = (tags: ReadonlyArray<ReadonlyArray<string>>, name: string): string | undefined => {
  const found: ReadonlyArray<string> | undefined = tags.find((tag: ReadonlyArray<string>) => tag.length >= 2 && tag[0] === name);
  if (!found) {
    return undefined;
  }
  const value: string | undefined = found[1];
  return value;
};

const uniqByIdNewestFirst = (items: ReadonlyArray<DecryptedDm>): ReadonlyArray<DecryptedDm> => {
  const map: Map<string, DecryptedDm> = new Map();
  items.forEach((item: DecryptedDm) => {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values()).sort((a: DecryptedDm, b: DecryptedDm) => b.createdAtUnixSeconds - a.createdAtUnixSeconds);
};

export const DirectMessagesCard = () => {
  const identity = useIdentity();
  const [state, setState] = useState<DirectMessagesState>(createInitialState());
  const [peerPublicKeyHexInput, setPeerPublicKeyHexInput] = useState<string>("");
  const [outgoingText, setOutgoingText] = useState<string>("");
  const subId: string = useMemo(() => createSubId(), []);
  const hasRequestedRef = useRef<boolean>(false);
  const myPublicKeyHex: PublicKeyHex | undefined = identity.state.publicKeyHex;
  const myPrivateKeyHex: PrivateKeyHex | undefined = identity.state.privateKeyHex;
  const pool = useRelayPool(state.relayUrls);

  useEffect(() => {
    const run = async (): Promise<void> => {
      try {
        const result: Awaited<ReturnType<typeof fetchBootstrapConfig>> = await fetchBootstrapConfig();
        if (result.error) {
          setState(createErrorState(result.error));
          return;
        }
        const relayUrls: ReadonlyArray<string> = result.data?.relays ?? [];
        setState(createReadyState({ relayUrls, dms: [] }));
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
    if (!myPublicKeyHex || !myPrivateKeyHex) {
      return;
    }
    const unsubscribe: () => void = pool.subscribeToMessages((params: Readonly<{ url: string; message: string }>) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(params.message);
      } catch {
        return;
      }
      if (!Array.isArray(parsed) || parsed.length < 3) {
        return;
      }
      if (parsed[0] !== "EVENT") {
        return;
      }
      const eventCandidate: unknown = parsed[2];
      if (typeof eventCandidate !== "object" || eventCandidate === null) {
        return;
      }
      const event: Record<string, unknown> = eventCandidate as Record<string, unknown>;
      if (typeof event.kind !== "number" || event.kind !== 4) {
        return;
      }
      const id: unknown = event.id;
      const pubkey: unknown = event.pubkey;
      const createdAt: unknown = event.created_at;
      const content: unknown = event.content;
      if (typeof id !== "string" || typeof pubkey !== "string" || typeof createdAt !== "number" || typeof content !== "string") {
        return;
      }
      if (!Array.isArray(event.tags)) {
        return;
      }
      if (!isPublicKeyHex(pubkey)) {
        return;
      }
      const tags: ReadonlyArray<ReadonlyArray<string>> = (event.tags as ReadonlyArray<unknown>)
        .filter((tag: unknown): tag is ReadonlyArray<unknown> => Array.isArray(tag))
        .map((tag: ReadonlyArray<unknown>) => tag.filter((item: unknown): item is string => typeof item === "string"));
      const recipient: string | undefined = getTagValue(tags, "p");
      if (!recipient || !isPublicKeyHex(recipient) || recipient !== myPublicKeyHex) {
        return;
      }
      const senderPublicKeyHex: PublicKeyHex = pubkey;
      void nip04Decrypt({ recipientPrivateKeyHex: myPrivateKeyHex, senderPublicKeyHex, payload: content })
        .then((plaintext: string) => {
          const dm: DecryptedDm = { id, senderPublicKeyHex, recipientPublicKeyHex: recipient, createdAtUnixSeconds: createdAt, plaintext };
          setState((prev: DirectMessagesState) => {
            if (prev.status !== "ready") {
              return prev;
            }
            const dms: ReadonlyArray<DecryptedDm> = uniqByIdNewestFirst([dm, ...prev.dms]).slice(0, 100);
            return createReadyState({ relayUrls: prev.relayUrls, dms });
          });
        })
        .catch(() => {
          return;
        });
    });
    return () => {
      unsubscribe();
    };
  }, [myPrivateKeyHex, myPublicKeyHex, pool, state.status]);

  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }
    if (!myPublicKeyHex) {
      return;
    }
    if (hasRequestedRef.current) {
      return;
    }
    const hasOpen: boolean = pool.connections.some((connection) => connection.status === "open");
    if (!hasOpen) {
      return;
    }
    hasRequestedRef.current = true;
    pool.sendToOpen(JSON.stringify(["REQ", subId, { kinds: [4], "#p": [myPublicKeyHex], limit: 50 }]));
  }, [myPublicKeyHex, pool, state.status, subId]);

  const canSend: boolean = useMemo(() => {
    if (identity.state.status !== "unlocked" || !myPrivateKeyHex || !myPublicKeyHex) {
      return false;
    }
    if (!isPublicKeyHex(peerPublicKeyHexInput)) {
      return false;
    }
    return outgoingText.trim().length > 0;
  }, [identity.state.status, myPrivateKeyHex, myPublicKeyHex, outgoingText, peerPublicKeyHexInput]);

  const send = async (): Promise<void> => {
    if (!canSend) {
      return;
    }
    if (!myPrivateKeyHex || !myPublicKeyHex) {
      return;
    }
    if (!isPrivateKeyHex(myPrivateKeyHex)) {
      return;
    }
    const recipientPublicKeyHex: PublicKeyHex = peerPublicKeyHexInput.trim().toLowerCase() as PublicKeyHex;
    const plaintext: string = outgoingText.trim();
    const event: NostrEvent = await createNostrDmEvent({ senderPrivateKeyHex: myPrivateKeyHex, recipientPublicKeyHex, plaintext });
    pool.sendToOpen(JSON.stringify(["EVENT", event]));
    setOutgoingText("");
    const dm: DecryptedDm = { id: event.id, senderPublicKeyHex: myPublicKeyHex, recipientPublicKeyHex, createdAtUnixSeconds: event.created_at, plaintext };
    setState((prev: DirectMessagesState) => {
      if (prev.status !== "ready") {
        return prev;
      }
      const dms: ReadonlyArray<DecryptedDm> = uniqByIdNewestFirst([dm, ...prev.dms]).slice(0, 100);
      return createReadyState({ relayUrls: prev.relayUrls, dms });
    });
  };

  if (state.status === "loading") {
    return (
      <Card title="Direct messages" description="Private 1:1 chats (NIP-04, kind:4).">
        <div>Loading…</div>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card tone="danger" title="Direct messages" description="Private 1:1 chats (NIP-04, kind:4).">
        <div className="wrap-break-word">{state.error}</div>
      </Card>
    );
  }

  return (
    <Card title="Direct messages" description="Private 1:1 chats (NIP-04, kind:4).">
      <div>
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Your public key (hex)</div>
        <div className="mt-2 rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-xs wrap-break-word dark:border-white/10 dark:bg-zinc-950/60">
          {myPublicKeyHex ?? "(locked)"}
        </div>
      </div>
      <div className="mt-4">
        <Label>Friend public key (hex)</Label>
        <Input value={peerPublicKeyHexInput} onChange={(e) => setPeerPublicKeyHexInput(e.target.value)} type="text" placeholder="64-hex pubkey" />
      </div>
      <div className="mt-3">
        <Label>Message</Label>
        <Input value={outgoingText} onChange={(e) => setOutgoingText(e.target.value)} type="text" placeholder="Type a private message" />
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" onClick={() => void send()} disabled={!canSend}>
          Send
        </Button>
        <div className="text-xs text-zinc-600 dark:text-zinc-400">
          Identity: <span className="font-medium text-zinc-900 dark:text-zinc-100">{identity.state.status}</span>
        </div>
      </div>
      <div className="mt-5">
        <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Inbox</div>
        <ul className="mt-2 space-y-2">
          {state.dms.length === 0 ? <li className="text-xs text-zinc-600 dark:text-zinc-400">No DMs yet.</li> : null}
          {state.dms.slice(0, 15).map((dm: DecryptedDm) => (
            <li key={dm.id} className="flex flex-col gap-1 rounded-xl border border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-zinc-950/60">
              <div className="text-xs text-zinc-600 dark:text-zinc-400 font-mono wrap-break-word">{dm.senderPublicKeyHex}</div>
              <div className="text-sm wrap-break-word">{dm.plaintext}</div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
};
