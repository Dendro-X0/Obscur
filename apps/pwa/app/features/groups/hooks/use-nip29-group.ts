"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { UnsignedNostrEvent } from "../../crypto/crypto-interfaces";
import { cryptoService } from "../../crypto/crypto-service";
import { logAppEvent } from "@/app/shared/log-app-event";

type NostrPool = Readonly<{
  sendToOpen: (payload: string) => void;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
  subscribe: (filters: ReadonlyArray<NostrFilter>, onEvent: (event: NostrEvent) => void) => string;
  unsubscribe: (id: string) => void;
  publishToAll: (payload: string) => Promise<MultiRelayPublishResult>;
}>;

type MultiRelayPublishResult = Readonly<{
  success: boolean;
  successCount: number;
  totalRelays: number;
  results: ReadonlyArray<Readonly<{ success: boolean; relayUrl: string; error?: string; latency?: number }>>;
  overallError?: string;
}>;

type NostrFilter = Readonly<{
  kinds?: ReadonlyArray<number>;
  authors?: ReadonlyArray<string>;
  since?: number;
  limit?: number;
  "#h"?: ReadonlyArray<string>;
  "#d"?: ReadonlyArray<string>;
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

type GroupRole = "owner" | "moderator" | "member" | "guest";

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
  membership: Readonly<{ status: GroupMembershipStatus; role: GroupRole }>;
  messages: ReadonlyArray<GroupMessageEvent>;
  joinRequests: ReadonlyArray<Readonly<{ pubkey: PublicKeyHex; createdAt: number; content: string }>>;
  admins: ReadonlyArray<Readonly<{ pubkey: PublicKeyHex; roles: ReadonlyArray<string> }>>;
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
  approveJoin: (params: Readonly<{ publicKeyHex: PublicKeyHex; role?: GroupRole }>) => Promise<void>;
  denyJoin: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => Promise<void>;
  sendMessage: (params: Readonly<{ content: string }>) => Promise<void>;
  updateMetadata: (params: Readonly<GroupMetadata>) => Promise<void>;
  putUser: (params: Readonly<{ publicKeyHex: PublicKeyHex; role?: GroupRole }>) => Promise<void>;
  removeUser: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => Promise<void>;
  admins: ReadonlyArray<Readonly<{ pubkey: PublicKeyHex; roles: ReadonlyArray<string> }>>;
}>;

const GROUP_KIND_METADATA = 39000;
const GROUP_KIND_ADMINS = 39001;
const GROUP_KIND_MEMBERS = 39002;
const GROUP_KIND_ROLES = 39003;
const GROUP_KIND_JOIN_REQUEST = 9021;
const GROUP_KIND_PUT_USER = 9000;
const GROUP_KIND_REMOVE_USER = 9001;
const GROUP_KIND_NOTE = 1;

const createInitialState = (): Nip29GroupState => {
  return {
    status: "idle",
    membership: { status: "unknown", role: "guest" },
    messages: [],
    joinRequests: [],
    admins: [],
    relayFeedback: {},
  };
};

const createRandomId = (): string => Math.random().toString(36).slice(2);

const getTagValue = (tags: ReadonlyArray<ReadonlyArray<string>>, name: string): string | undefined => {
  const match = tags.find((t: ReadonlyArray<string>): boolean => t[0] === name);
  return match?.[1];
};

const hasTag = (tags: ReadonlyArray<ReadonlyArray<string>>, name: string): boolean => {
  return tags.some((t: ReadonlyArray<string>): boolean => t[0] === name);
};

const parseGroupMetadata = (event: NostrEvent): GroupMetadata => {
  return {
    name: getTagValue(event.tags, "name"),
    about: getTagValue(event.tags, "about"),
    picture: getTagValue(event.tags, "picture"),
    isPrivate: hasTag(event.tags, "private"),
    isRestricted: hasTag(event.tags, "restricted"),
    isHidden: hasTag(event.tags, "hidden"),
    isClosed: hasTag(event.tags, "closed")
  };
};

const parsePubkeysFromPTags = (event: NostrEvent): ReadonlyArray<PublicKeyHex> => {
  return event.tags.filter((t: ReadonlyArray<string>): boolean => t[0] === "p" && typeof t[1] === "string").map((t: ReadonlyArray<string>): PublicKeyHex => t[1] as PublicKeyHex);
};

const findMyRole = (params: Readonly<{ myPublicKeyHex: PublicKeyHex | null; admins: ReadonlyArray<Readonly<{ pubkey: PublicKeyHex; roles: ReadonlyArray<string> }>>; members: ReadonlyArray<PublicKeyHex>; isUnmanaged: boolean }>): Readonly<{ membership: GroupMembershipStatus; role: GroupRole }> => {
  if (!params.myPublicKeyHex) {
    return { membership: "unknown", role: "guest" };
  }
  if (params.isUnmanaged) {
    return { membership: "member", role: "member" };
  }
  const admin = params.admins.find((a): boolean => a.pubkey === params.myPublicKeyHex);
  if (admin) {
    const rolesLower = admin.roles.map((r: string): string => r.toLowerCase());
    if (rolesLower.includes("owner") || rolesLower.includes("admin") || rolesLower.includes("ceo")) {
      return { membership: "member", role: "owner" };
    }
    return { membership: "member", role: "moderator" };
  }
  if (params.members.includes(params.myPublicKeyHex)) {
    return { membership: "member", role: "member" };
  }
  return { membership: "not_member", role: "guest" };
};

export const useNip29Group = (params: UseNip29GroupParams): UseNip29GroupResult => {
  const [state, setState] = useState<Nip29GroupState>(() => createInitialState());
  const [admins, setAdmins] = useState<ReadonlyArray<Readonly<{ pubkey: PublicKeyHex; roles: ReadonlyArray<string> }>>>([]);
  const [members, setMembers] = useState<ReadonlyArray<PublicKeyHex>>([]);
  const [isUnmanaged, setIsUnmanaged] = useState<boolean>(false);

  useEffect((): (() => void) => {
    if (!params.relayUrl || !params.groupId) {
      return (): void => { };
    }
    queueMicrotask((): void => {
      setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, status: "loading", error: undefined }));
    });
    const unsubscribeMessages = params.pool.subscribeToMessages((evt: Readonly<{ message: string }>): void => {
      try {
        const parsed: unknown = JSON.parse(evt.message);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          return;
        }
        const kind: unknown = parsed[0];
        if (kind === "NOTICE" && typeof parsed[1] === "string") {
          setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, relayFeedback: { ...prev.relayFeedback, lastNotice: parsed[1] } }));
        }
        if (kind === "OK" && typeof parsed[1] === "string") {
          const accepted: boolean = Boolean(parsed[2]);
          const message: string = typeof parsed[3] === "string" ? parsed[3] : "";
          setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, relayFeedback: { ...prev.relayFeedback, lastOk: { accepted, message } } }));
        }
      } catch {
        return;
      }
    });

    const onEvent = (event: NostrEvent): void => {
      if (event.kind === GROUP_KIND_METADATA) {
        setIsUnmanaged(false);
        setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, metadata: parseGroupMetadata(event), status: "ready" }));
        return;
      }
      if (event.kind === GROUP_KIND_ADMINS) {
        const nextAdmins = event.tags.filter((t: ReadonlyArray<string>): boolean => t[0] === "p" && typeof t[1] === "string").map((t: ReadonlyArray<string>): Readonly<{ pubkey: PublicKeyHex; roles: ReadonlyArray<string> }> => ({ pubkey: t[1] as PublicKeyHex, roles: t.slice(2) }));
        setAdmins(nextAdmins);
        return;
      }
      if (event.kind === GROUP_KIND_MEMBERS) {
        setMembers(parsePubkeysFromPTags(event));
        return;
      }
      if (event.kind === GROUP_KIND_JOIN_REQUEST) {
        const pubkey = event.pubkey as PublicKeyHex;
        setState((prev: Nip29GroupState): Nip29GroupState => {
          if (prev.joinRequests.some((r): boolean => r.pubkey === pubkey)) {
            return prev;
          }
          const next = { pubkey, createdAt: event.created_at, content: event.content };
          return { ...prev, joinRequests: [next, ...prev.joinRequests].slice(0, 50) };
        });
        return;
      }
      if (event.kind === GROUP_KIND_NOTE) {
        const nextMsg: GroupMessageEvent = { id: event.id, pubkey: event.pubkey, created_at: event.created_at, content: event.content };
        setState((prev: Nip29GroupState): Nip29GroupState => {
          if (prev.messages.some((m): boolean => m.id === nextMsg.id)) {
            return prev;
          }
          return { ...prev, messages: [nextMsg, ...prev.messages].slice(0, 200), status: "ready" };
        });
        return;
      }
      if (event.kind === GROUP_KIND_ADMINS) {
        const nextAdmins = event.tags.filter((t: ReadonlyArray<string>): boolean => t[0] === "p" && typeof t[1] === "string").map((t: ReadonlyArray<string>): Readonly<{ pubkey: PublicKeyHex; roles: ReadonlyArray<string> }> => ({ pubkey: t[1] as PublicKeyHex, roles: t.slice(2) }));
        setAdmins(nextAdmins);
        setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, admins: nextAdmins }));
        return;
      }
    };

    const metadataSubId = params.pool.subscribe([{ kinds: [GROUP_KIND_METADATA], "#d": [params.groupId] }], onEvent);
    const adminsSubId = params.pool.subscribe([{ kinds: [GROUP_KIND_ADMINS], "#d": [params.groupId] }], onEvent);
    const membersSubId = params.pool.subscribe([{ kinds: [GROUP_KIND_MEMBERS], "#d": [params.groupId] }], onEvent);
    const rolesSubId = params.pool.subscribe([{ kinds: [GROUP_KIND_ROLES], "#d": [params.groupId] }], onEvent);
    const timelineSubId = params.pool.subscribe([{ kinds: [GROUP_KIND_NOTE], "#h": [params.groupId], limit: 50 }], onEvent);
    const joinReqSubId = params.pool.subscribe([{ kinds: [GROUP_KIND_JOIN_REQUEST], "#h": [params.groupId], limit: 50 }], onEvent);

    queueMicrotask((): void => {
      setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, status: "ready" }));
      setIsUnmanaged(true);
    });

    return (): void => {
      unsubscribeMessages();
      params.pool.unsubscribe(metadataSubId);
      params.pool.unsubscribe(adminsSubId);
      params.pool.unsubscribe(membersSubId);
      params.pool.unsubscribe(rolesSubId);
      params.pool.unsubscribe(timelineSubId);
      params.pool.unsubscribe(joinReqSubId);
    };
  }, [params.groupId, params.pool, params.relayUrl]);

  const computedMembership = useMemo((): Readonly<{ status: GroupMembershipStatus; role: GroupRole }> => {
    const derived = findMyRole({ myPublicKeyHex: params.myPublicKeyHex, admins, members, isUnmanaged: isUnmanaged && !state.metadata });
    if (derived.membership === "member") {
      return { status: "member", role: derived.role };
    }
    if (state.membership.status === "requested") {
      return { status: "requested", role: "guest" };
    }
    if (derived.membership === "unknown") {
      return { status: "unknown", role: "guest" };
    }
    return { status: "not_member", role: "guest" };
  }, [admins, isUnmanaged, members, params.myPublicKeyHex, state.membership.status, state.metadata]);

  const refresh = useCallback((): void => {
    setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, status: "loading", error: undefined }));
    queueMicrotask((): void => {
      setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, status: "ready" }));
    });
  }, []);
  const requestJoin = useCallback(async (): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) {
      setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, error: "Unlock your identity to request joining." }));
      return;
    }
    const unsigned: UnsignedNostrEvent = {
      kind: GROUP_KIND_JOIN_REQUEST,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["h", params.groupId]],
      content: "",
      pubkey: params.myPublicKeyHex
    };
    const signed: NostrEvent = await cryptoService.signEvent(unsigned, params.myPrivateKeyHex);
    const payload: string = JSON.stringify(["EVENT", signed]);
    logAppEvent({ name: "groups.join_request.attempt", level: "info", scope: { feature: "groups", action: "join_request" }, context: { groupId: params.groupId } });
    const result = await params.pool.publishToAll(payload);
    setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, membership: { ...prev.membership, status: "requested" }, relayFeedback: { ...prev.relayFeedback, lastOk: { accepted: result.success, message: result.overallError ?? "" } } }));
  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, params.pool]);

  const approveJoin = useCallback(async (approveParams: Readonly<{ publicKeyHex: PublicKeyHex; role?: GroupRole }>): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) {
      setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, error: "Unlock your identity to approve join requests." }));
      return;
    }
    const roleTag: string | undefined = approveParams.role && approveParams.role !== "guest" ? approveParams.role : "member";
    const unsigned: UnsignedNostrEvent = {
      kind: GROUP_KIND_PUT_USER,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["h", params.groupId], ["p", approveParams.publicKeyHex, roleTag]],
      content: "",
      pubkey: params.myPublicKeyHex
    };
    const signed: NostrEvent = await cryptoService.signEvent(unsigned, params.myPrivateKeyHex);
    const payload: string = JSON.stringify(["EVENT", signed]);
    logAppEvent({ name: "groups.join_approve.attempt", level: "info", scope: { feature: "groups", action: "approve_join" }, context: { groupId: params.groupId } });
    const result = await params.pool.publishToAll(payload);
    setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, joinRequests: prev.joinRequests.filter((r): boolean => r.pubkey !== approveParams.publicKeyHex), relayFeedback: { ...prev.relayFeedback, lastOk: { accepted: result.success, message: result.overallError ?? "" } } }));
  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, params.pool]);

  const denyJoin = useCallback(async (denyParams: Readonly<{ publicKeyHex: PublicKeyHex }>): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) {
      setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, error: "Unlock your identity to deny join requests." }));
      return;
    }
    const unsigned: UnsignedNostrEvent = {
      kind: GROUP_KIND_REMOVE_USER,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["h", params.groupId], ["p", denyParams.publicKeyHex]],
      content: "",
      pubkey: params.myPublicKeyHex
    };
    const signed: NostrEvent = await cryptoService.signEvent(unsigned, params.myPrivateKeyHex);
    const payload: string = JSON.stringify(["EVENT", signed]);
    logAppEvent({ name: "groups.join_deny.attempt", level: "info", scope: { feature: "groups", action: "deny_join" }, context: { groupId: params.groupId } });
    const result = await params.pool.publishToAll(payload);
    setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, joinRequests: prev.joinRequests.filter((r): boolean => r.pubkey !== denyParams.publicKeyHex), relayFeedback: { ...prev.relayFeedback, lastOk: { accepted: result.success, message: result.overallError ?? "" } } }));
  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, params.pool]);

  const sendMessage = useCallback(async (sendParams: Readonly<{ content: string }>): Promise<void> => {
    const content: string = sendParams.content.trim();
    if (!content) {
      return;
    }
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) {
      setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, error: "Unlock your identity to post." }));
      return;
    }
    const nowUnixSeconds: number = Math.floor(Date.now() / 1000);
    const optimisticEvent: GroupMessageEvent = { id: createRandomId(), pubkey: params.myPublicKeyHex, created_at: nowUnixSeconds, content };
    setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, messages: [optimisticEvent, ...prev.messages].slice(0, 200) }));
    const unsigned: UnsignedNostrEvent = {
      kind: GROUP_KIND_NOTE,
      created_at: nowUnixSeconds,
      tags: [["h", params.groupId]],
      content,
      pubkey: params.myPublicKeyHex
    };
    const signed: NostrEvent = await cryptoService.signEvent(unsigned, params.myPrivateKeyHex);
    const payload: string = JSON.stringify(["EVENT", signed]);
    const result = await params.pool.publishToAll(payload);
    setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, relayFeedback: { ...prev.relayFeedback, lastOk: { accepted: result.success, message: result.overallError ?? "" } } }));
  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, params.pool]);

  const updateMetadata = useCallback(async (metadata: Readonly<GroupMetadata>): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) {
      setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, error: "Unlock your identity to update metadata." }));
      return;
    }

    const tags: string[][] = [["d", params.groupId]];
    if (metadata.name) tags.push(["name", metadata.name]);
    if (metadata.about) tags.push(["about", metadata.about]);
    if (metadata.picture) tags.push(["picture", metadata.picture]);
    // Preserve existing flags if not explicitly unset/changed (simplified for now, usually you'd want to merge)
    // For this implementation, we just send what's passed.

    // NIP-29 Edit Metadata is event kind 39000 (same as metadata definition, but re-published)
    // Actually, NIP-29 uses Kind 9002 for "Edit Metadata Proposal" if not admin? 
    // Or normally admins just publish Kind 39000 directly to the relay.
    // Based on GroupService, it uses GROUP_KINDS.EDIT_METADATA which is likely a proposal or the event itself.
    // Let's assume we are admins and publishing Kind 39000 (GROUP_KIND_METADATA) directly or a proposal.
    // If we want to use GroupService logic, we should use it. But here we are building events manually for consistency with other methods in this hook.
    // Correction: NIP-29 generally uses Kind 9002 (Edit Metadata) which the relay then processes to update the internal state (Kind 39000).
    const EDIT_METADATA_KIND = 9002;

    const unsigned: UnsignedNostrEvent = {
      kind: EDIT_METADATA_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [["h", params.groupId], ...tags.filter(t => t[0] !== "d")], // h tag is used for command, d tag is effectively the group ID but handled by h in commands
      content: "",
      pubkey: params.myPublicKeyHex
    };

    const signed: NostrEvent = await cryptoService.signEvent(unsigned, params.myPrivateKeyHex);
    const payload: string = JSON.stringify(["EVENT", signed]);
    logAppEvent({ name: "groups.update_metadata.attempt", level: "info", scope: { feature: "groups", action: "update_metadata" }, context: { groupId: params.groupId } });

    const result = await params.pool.publishToAll(payload);

    // Optimistic update
    setState((prev: Nip29GroupState): Nip29GroupState => ({
      ...prev,
      metadata: { ...prev.metadata, ...metadata },
      relayFeedback: { ...prev.relayFeedback, lastOk: { accepted: result.success, message: result.overallError ?? "" } }
    }));

  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, params.pool]);

  const derivedState: Nip29GroupState = useMemo((): Nip29GroupState => {
    return { ...state, membership: computedMembership };
  }, [computedMembership, state]);
  const result: UseNip29GroupResult = useMemo((): UseNip29GroupResult => {
    return {
      state: derivedState,
      refresh,
      requestJoin,
      approveJoin,
      denyJoin,
      sendMessage,
      updateMetadata,
      putUser: approveJoin,
      removeUser: denyJoin,
      admins: admins
    };
  }, [admins, approveJoin, denyJoin, derivedState, refresh, requestJoin, sendMessage, updateMetadata]);
  return result;
};
