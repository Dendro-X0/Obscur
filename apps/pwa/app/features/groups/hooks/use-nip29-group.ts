"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type NostrPool = Readonly<{
  sendToOpen: (payload: string) => void;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
}>;

type GroupMetadata = Readonly<{
  name?: string;
  about?: string;
  picture?: string;
  isPrivate?: boolean;
  isRestricted?: boolean;
  isHidden?: boolean;
  isClosed?: boolean;
}>;

type GroupMembershipStatus = "unknown" | "member" | "not_member" | "requested";

type RelayOkFeedback = Readonly<{
  accepted: boolean;
  message: string;
}>;

type RelayFeedback = Readonly<{
  lastOk?: RelayOkFeedback;
  lastNotice?: string;
}>;

type GroupMessageEvent = Readonly<{
  id: string;
  pubkey: string;
  created_at: number;
  content: string;
}>;

type Nip29GroupState = Readonly<{
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
  metadata?: GroupMetadata;
  membership: Readonly<{ status: GroupMembershipStatus }>;
  messages: ReadonlyArray<GroupMessageEvent>;
  relayFeedback: RelayFeedback;
}>;

type UseNip29GroupParams = Readonly<{
  pool: NostrPool;
  relayUrl: string;
  groupId: string;
  myPublicKeyHex: PublicKeyHex | null;
  myPrivateKeyHex: PrivateKeyHex | null;
}>;

type UseNip29GroupResult = Readonly<{
  state: Nip29GroupState;
  refresh: () => void;
  requestJoin: () => Promise<void>;
  sendMessage: (params: Readonly<{ content: string }>) => Promise<void>;
}>;

const createInitialState = (): Nip29GroupState => {
  return {
    status: "idle",
    membership: { status: "unknown" },
    messages: [],
    relayFeedback: {},
  };
};

const createRandomId = (): string => {
  return Math.random().toString(36).slice(2);
};

export const useNip29Group = (params: UseNip29GroupParams): UseNip29GroupResult => {
  const [state, setState] = useState<Nip29GroupState>(() => createInitialState());
  useEffect((): (() => void) => {
    if (!params.relayUrl || !params.groupId) {
      return (): void => {};
    }
    setState((prev: Nip29GroupState): Nip29GroupState => {
      if (prev.status === "idle") {
        return { ...prev, status: "loading" };
      }
      return prev;
    });
    const unsubscribe = params.pool.subscribeToMessages((evt: Readonly<{ message: string }>): void => {
      try {
        const parsed: unknown = JSON.parse(evt.message);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          return;
        }
        const kind: unknown = parsed[0];
        if (kind === "NOTICE" && typeof parsed[1] === "string") {
          setState((prev: Nip29GroupState): Nip29GroupState => ({
            ...prev,
            relayFeedback: { ...prev.relayFeedback, lastNotice: parsed[1] },
            status: "ready",
          }));
        }
        if (kind === "OK" && typeof parsed[1] === "string") {
          const accepted: boolean = Boolean(parsed[2]);
          const message: string = typeof parsed[3] === "string" ? parsed[3] : "";
          setState((prev: Nip29GroupState): Nip29GroupState => ({
            ...prev,
            relayFeedback: { ...prev.relayFeedback, lastOk: { accepted, message } },
            status: "ready",
          }));
        }
      } catch {
        return;
      }
    });
    queueMicrotask((): void => {
      setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, status: "ready" }));
    });
    return unsubscribe;
  }, [params.groupId, params.pool, params.relayUrl]);
  const refresh = useCallback((): void => {
    setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, status: "loading", error: undefined }));
    queueMicrotask((): void => {
      setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, status: "ready" }));
    });
  }, []);
  const requestJoin = useCallback(async (): Promise<void> => {
    setState((prev: Nip29GroupState): Nip29GroupState => ({
      ...prev,
      membership: { status: "requested" },
    }));
  }, []);
  const sendMessage = useCallback(async (sendParams: Readonly<{ content: string }>): Promise<void> => {
    const content: string = sendParams.content.trim();
    if (!content) {
      return;
    }
    const nowUnixSeconds: number = Math.floor(Date.now() / 1000);
    const pubkey: string = params.myPublicKeyHex ?? "";
    const optimisticEvent: GroupMessageEvent = {
      id: createRandomId(),
      pubkey,
      created_at: nowUnixSeconds,
      content,
    };
    setState((prev: Nip29GroupState): Nip29GroupState => ({
      ...prev,
      messages: [optimisticEvent, ...prev.messages],
    }));
    try {
      params.pool.sendToOpen(JSON.stringify(["EVENT", { content }]));
    } catch {
      return;
    }
  }, [params.myPublicKeyHex, params.pool]);
  const result: UseNip29GroupResult = useMemo((): UseNip29GroupResult => {
    return { state, refresh, requestJoin, sendMessage };
  }, [refresh, requestJoin, sendMessage, state]);
  return result;
};
