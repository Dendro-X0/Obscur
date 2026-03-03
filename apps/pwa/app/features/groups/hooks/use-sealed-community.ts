"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { UnsignedNostrEvent } from "../../crypto/crypto-interfaces";
import { cryptoService } from "../../crypto/crypto-service";
import { logAppEvent } from "@/app/shared/log-app-event";
import { CommunityAccessGuard } from "@/app/features/groups/services/community-access-guard";
import { GroupService } from "@/app/features/groups/services/group-service";
import { toast } from "../../../components/ui/toast";
import type { GroupRole, GroupMembershipStatus, GroupMetadata, GroupAccessMode } from "../types";
import {
  transitionCommunityConnection
} from "../../messaging/state-machines/community-membership-machine";
import { messageBus } from "../../messaging/services/message-bus";
import type { Message } from "../../messaging/types";
import { toGroupConversationId } from "../utils/group-conversation-id";
import {
  createCommunityLedgerState,
  reduceCommunityLedger,
  selectActiveMembers,
  selectExpelledMembers,
  selectLeftMembers,
  selectMembershipStatus,
  type CommunityLedgerEvent,
  type CommunityLedgerState
} from "../services/community-ledger-reducer";

type NostrPool = Readonly<{
  sendToOpen: (payload: string) => void;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
  subscribe: (filters: ReadonlyArray<NostrFilter>, onEvent: (event: NostrEvent, url: string) => void) => string;
  unsubscribe: (id: string) => void;
  publishToUrl?: (url: string, payload: string) => Promise<PublishResult>;
  publishToUrls?: (urls: ReadonlyArray<string>, payload: string) => Promise<MultiRelayPublishResult>;
  publishToRelay?: (url: string, payload: string) => Promise<PublishResult>;
  publishToAll: (payload: string) => Promise<MultiRelayPublishResult>;
}>;

type MultiRelayPublishResult = Readonly<{
  success: boolean;
  successCount: number;
  totalRelays: number;
  results: ReadonlyArray<Readonly<{ success: boolean; relayUrl: string; error?: string; latency?: number }>>;
  overallError?: string;
}>;

type PublishResult = Readonly<{
  success: boolean;
  relayUrl: string;
  error?: string;
  latency?: number;
}>;

type NostrFilter = Readonly<{
  kinds?: ReadonlyArray<number>;
  authors?: ReadonlyArray<string>;
  since?: number;
  limit?: number;
  "#h"?: ReadonlyArray<string>;
  "#d"?: ReadonlyArray<string>;
}>;

type RelayOkFeedback = Readonly<{
  accepted: boolean;
  message: string;
}>;

type RelayFeedback = Readonly<{
  lastOk?: RelayOkFeedback;
  lastNotice?: string;
}>;

export type GroupMessageEvent = Readonly<{
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
  kickVotes: Readonly<Record<PublicKeyHex, string[]>>;
  expelledMembers: ReadonlyArray<PublicKeyHex>;
  leftMembers: ReadonlyArray<PublicKeyHex>;
  disbandedAt?: number;
}>;

type UseSealedCommunityParams = Readonly<{
  pool: NostrPool;
  relayUrl: string;
  groupId: string;
  communityId?: string;
  myPublicKeyHex: PublicKeyHex | null;
  myPrivateKeyHex: PrivateKeyHex | null;
  enabled?: boolean;
  initialMembers?: ReadonlyArray<PublicKeyHex>;
}>;

type UseSealedCommunityResult = Readonly<{
  state: Nip29GroupState;
  refresh: () => void;
  requestJoin: () => Promise<void>;
  approveJoin: (params: Readonly<{ publicKeyHex: PublicKeyHex; role?: GroupRole }>) => Promise<void>;
  denyJoin: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => Promise<void>;
  approveAllJoinRequests: () => Promise<void>;
  denyAllJoinRequests: () => Promise<void>;
  sendMessage: (params: Readonly<{ content: string }>) => Promise<void>;
  sendVoteKick: (targetPubkey: string, reason?: string) => Promise<void>;
  rotateRoomKey: () => Promise<void>;
  updateMetadata: (params: Readonly<GroupMetadata>) => Promise<void>;
  setGroupStatus: (params: Readonly<{ access: "open" | "invite-only" | "discoverable" }>) => Promise<void>;
  putUser: (params: Readonly<{ publicKeyHex: PublicKeyHex; role?: GroupRole }>) => Promise<void>;
  removeUser: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => Promise<void>;
  promoteUser: (params: Readonly<{ publicKeyHex: PublicKeyHex; role: "owner" | "moderator" }>) => Promise<void>;
  demoteUser: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => Promise<void>;
  leaveGroup: () => Promise<void>;
  deleteMessage: (params: Readonly<{ eventId: string; reason?: string }>) => Promise<void>;
  members: ReadonlyArray<PublicKeyHex>;
  admins: ReadonlyArray<Readonly<{ pubkey: PublicKeyHex; roles: ReadonlyArray<string> }>>;
}>;

const GROUP_KIND_SEALED = 10105;
const GROUP_KIND_DELETE = 5;
const GROUP_KIND_METADATA = 39000;
const GROUP_KIND_MEMBERS = 39002;

export const normalizeRelayUrl = (url: string): string => url.trim().toLowerCase().replace(/\/+$/, "");

export const isScopedRelayEvent = (params: Readonly<{ scopedRelayUrl: string; eventRelayUrl: string }>): boolean => {
  return normalizeRelayUrl(params.eventRelayUrl) === normalizeRelayUrl(params.scopedRelayUrl);
};

export const hasCommunityBindingTag = (params: Readonly<{ event: NostrEvent; groupId: string }>): boolean => {
  const tags = Array.isArray(params.event.tags) ? params.event.tags : [];
  return tags.some((tag) => {
    if (!Array.isArray(tag) || tag.length < 2) return false;
    const key = tag[0];
    const value = tag[1];
    if (typeof key !== "string" || typeof value !== "string") return false;
    if (key !== "h" && key !== "d") return false;
    return value === params.groupId;
  });
};

const createInitialState = (): Nip29GroupState => {
  return {
    status: "idle",
    membership: { status: "unknown", role: "member" },
    messages: [],
    joinRequests: [],
    admins: [],
    relayFeedback: {},
    kickVotes: {},
    expelledMembers: [],
    leftMembers: []
  };
};

const createRandomId = (): string => Math.random().toString(36).slice(2);

export const useSealedCommunity = (params: UseSealedCommunityParams): UseSealedCommunityResult => {
  const [state, setState] = useState<Nip29GroupState>(() => createInitialState());
  const [members, setMembers] = useState<ReadonlyArray<PublicKeyHex>>(() => params.initialMembers ?? []);
  const ledgerRef = useRef<CommunityLedgerState>(createCommunityLedgerState(params.initialMembers ?? []));
  const initialMembersKey = useMemo(() => (params.initialMembers ?? []).join(","), [params.initialMembers]);
  const membersRef = useRef<ReadonlyArray<PublicKeyHex>>(params.initialMembers ?? []);
  const leftMembersRef = useRef<ReadonlyArray<PublicKeyHex>>(state.leftMembers);
  const expelledMembersRef = useRef<ReadonlyArray<PublicKeyHex>>(state.expelledMembers);
  const disbandedAtRef = useRef<number | undefined>(state.disbandedAt);
  const disbandHandledRef = useRef(false);
  const conversationId = useMemo(
    () => toGroupConversationId({ groupId: params.groupId, relayUrl: params.relayUrl, communityId: params.communityId }),
    [params.groupId, params.relayUrl, params.communityId]
  );

  const applyLedgerEvent = useCallback((event: CommunityLedgerEvent): void => {
    const nextLedger = reduceCommunityLedger(ledgerRef.current, event);
    if (nextLedger === ledgerRef.current) return;
    ledgerRef.current = nextLedger;
    const activeMembers = selectActiveMembers(nextLedger);
    const leftMembers = selectLeftMembers(nextLedger);
    const expelledMembers = selectExpelledMembers(nextLedger);
    const myMembership = selectMembershipStatus(nextLedger, params.myPublicKeyHex);

    setMembers(activeMembers);
    setState((prev) => ({
      ...prev,
      leftMembers,
      expelledMembers,
      disbandedAt: nextLedger.disbandedAt,
      membership: { ...prev.membership, status: myMembership }
    }));
  }, [params.myPublicKeyHex]);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    leftMembersRef.current = state.leftMembers;
    expelledMembersRef.current = state.expelledMembers;
    disbandedAtRef.current = state.disbandedAt;
  }, [state.leftMembers, state.expelledMembers, state.disbandedAt]);

  useEffect(() => {
    if (!state.disbandedAt) return;
    if (disbandHandledRef.current) return;
    disbandHandledRef.current = true;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("obscur:group-remove", { detail: conversationId }));
    }
  }, [state.disbandedAt, conversationId]);

  useEffect(() => {
    const nextLedger = createCommunityLedgerState(params.initialMembers ?? []);
    disbandHandledRef.current = false;
    ledgerRef.current = nextLedger;
    const nextMembers = selectActiveMembers(nextLedger);
    const nextLeftMembers = selectLeftMembers(nextLedger);
    const nextExpelledMembers = selectExpelledMembers(nextLedger);
    const nextMyMembership = selectMembershipStatus(nextLedger, params.myPublicKeyHex);

    setMembers(nextMembers);
    setState((prev) => ({
      ...createInitialState(),
      status: prev.status === "error" ? "error" : "idle",
      leftMembers: nextLeftMembers,
      expelledMembers: nextExpelledMembers,
      disbandedAt: nextLedger.disbandedAt,
      membership: { ...prev.membership, status: nextMyMembership }
    }));
  }, [params.groupId, params.relayUrl, params.myPublicKeyHex, initialMembersKey]);

  useEffect((): (() => void) => {
    if (!params.relayUrl || !params.groupId || params.enabled === false) {
      return (): void => { };
    }
    const scopedRelayUrl = normalizeRelayUrl(params.relayUrl);

    // Connection load only. Membership must be derived from explicit lifecycle events.
    setState(prev => {
      const nextConn = transitionCommunityConnection(prev.status, { type: "START_LOAD" });
      return { ...prev, status: nextConn };
    });

    const onEvent = async (event: NostrEvent, url: string): Promise<void> => {
      if (!isScopedRelayEvent({ scopedRelayUrl, eventRelayUrl: url })) {
        logAppEvent({
          name: "community.event.rejected",
          level: "warn",
          scope: { feature: "groups", action: "sealed_receive" },
          context: {
            reason: "relay_scope_mismatch",
            eventId: event.id,
            expectedRelay: scopedRelayUrl,
            receivedRelay: normalizeRelayUrl(url)
          }
        });
        return;
      }
      if (!hasCommunityBindingTag({ event, groupId: params.groupId })) {
        logAppEvent({
          name: "community.event.rejected",
          level: "warn",
          scope: { feature: "groups", action: "sealed_receive" },
          context: {
            reason: "community_binding_mismatch",
            eventId: event.id,
            groupId: params.groupId
          }
        });
        return;
      }

      if (event.kind === GROUP_KIND_SEALED) {
        try {
          const { roomKeyStore } = await import("../../crypto/room-key-store");
          const record = await roomKeyStore.getRoomKeyRecord(params.groupId);
          if (!record) return;

          let decryptedPayload: string | undefined;
          const encryptedData = JSON.parse(event.content);

          // Try current key first
          try {
            decryptedPayload = await cryptoService.decryptGroupMessage(encryptedData, record.roomKeyHex);
          } catch (e) {
            // Try previous keys if current key fails
            if (record.previousKeys) {
              for (const oldKey of record.previousKeys) {
                try {
                  decryptedPayload = await cryptoService.decryptGroupMessage(encryptedData, oldKey);
                  break;
                } catch { continue; }
              }
            }
          }

          if (!decryptedPayload) {
            console.warn("Could not decrypt sealed message with any known key");
            logAppEvent({
              name: "community.event.rejected",
              level: "warn",
              scope: { feature: "groups", action: "sealed_receive" },
              context: {
                reason: "decrypt_failed",
                eventId: event.id
              }
            });
            return;
          }

          const innerPayload = JSON.parse(decryptedPayload);
          const actor = event.pubkey as PublicKeyHex;

          if (typeof innerPayload.pubkey === "string" && innerPayload.pubkey !== actor) {
            console.warn("Ignoring sealed event with actor mismatch", { eventId: event.id });
            logAppEvent({
              name: "community.event.rejected",
              level: "warn",
              scope: { feature: "groups", action: "sealed_receive" },
              context: {
                reason: "actor_mismatch",
                eventId: event.id
              }
            });
            return;
          }

          if (disbandedAtRef.current !== undefined && innerPayload.type !== "disband") {
            logAppEvent({
              name: "community.event.rejected",
              level: "info",
              scope: { feature: "groups", action: "sealed_receive" },
              context: {
                reason: "disbanded_terminal_state",
                eventId: event.id
              }
            });
            return;
          }

          if (innerPayload.type === "disband") {
            const ts = innerPayload.created_at || event.created_at;
            applyLedgerEvent({ type: "COMMUNITY_DISBANDED", timestamp: ts });
            return;
          }

          if (innerPayload.type === "community.created") {
            const ts = innerPayload.created_at || event.created_at;
            if (innerPayload.metadata && typeof innerPayload.metadata === "object") {
              setState((prev) => ({
                ...prev,
                metadata: {
                  id: params.groupId,
                  name: typeof innerPayload.metadata.name === "string" ? innerPayload.metadata.name : (prev.metadata?.name ?? params.groupId),
                  about: typeof innerPayload.metadata.about === "string" ? innerPayload.metadata.about : prev.metadata?.about,
                  picture: typeof innerPayload.metadata.picture === "string" ? innerPayload.metadata.picture : prev.metadata?.picture,
                  access: (innerPayload.metadata.access === "open" || innerPayload.metadata.access === "invite-only" || innerPayload.metadata.access === "discoverable")
                    ? innerPayload.metadata.access
                    : (prev.metadata?.access ?? "invite-only")
                }
              }));
            }
            applyLedgerEvent({ type: "MEMBER_JOINED", pubkey: actor, timestamp: ts });
            return;
          }

          // Consensus Moderation: Handle Votes
          if (innerPayload.type === "vote-kick") {
            const target = innerPayload.target as PublicKeyHex;
            const voter = actor;
            let shouldExpel = false;

            setState(prev => {
              const currentVotes = { ...prev.kickVotes };
              const targetVotes = [...(currentVotes[target] || [])];
              if (!targetVotes.includes(voter)) {
                targetVotes.push(voter);
              }
              currentVotes[target] = targetVotes;

              // Expulsion Logic: > 50% threshold, minimum 2 votes required
              const memberCount = membersRef.current.length;
              const threshold = memberCount > 0 ? Math.floor(memberCount / 2) : Infinity;
              shouldExpel = targetVotes.length >= 2 && targetVotes.length > threshold && !prev.expelledMembers.includes(target);

              return { ...prev, kickVotes: currentVotes };
            });
            if (shouldExpel) {
              applyLedgerEvent({ type: "MEMBER_EXPELLED", pubkey: target, timestamp: event.created_at });
              toast.error(`Consensus reached: Member ${target.slice(0, 8)}... has been expelled.`);
            }
            return;
          }

          // Handle explicit leaving
          if (innerPayload.type === "leave") {
            const leaver = actor;
            const ts = innerPayload.created_at || event.created_at;
            applyLedgerEvent({ type: "MEMBER_LEFT", pubkey: leaver, timestamp: ts });
            return;
          }

          // Handle explicit joining (from NIP-17 invites)
          if (innerPayload.type === "join") {
            const joiner = actor;
            const ts = innerPayload.created_at || event.created_at;
            applyLedgerEvent({ type: "MEMBER_JOINED", pubkey: joiner, timestamp: ts });
            return;
          }

          // Anti-Injection: Filter messages from expelled/left members
          // Use refs (not state) to avoid stale closure inside the async onEvent callback
          if (
            expelledMembersRef.current.includes(actor) ||
            leftMembersRef.current.includes(actor)
          ) {
            console.info(`Filtering message from expelled/left member: ${actor}`);
            return;
          }

          const nextMsg: GroupMessageEvent = {
            id: event.id,
            pubkey: actor,
            created_at: innerPayload.created_at || event.created_at,
            content: innerPayload.content
          };

          const author = nextMsg.pubkey as PublicKeyHex;

          // Emit to MessageBus for localized listeners
          const unifiedMsg: Message = {
            id: event.id,
            kind: 'user',
            content: innerPayload.content,
            timestamp: new Date(nextMsg.created_at * 1000),
            isOutgoing: (author === params.myPublicKeyHex),
            status: 'delivered',
            senderPubkey: author,
            conversationId
          };
          messageBus.emitNewMessage(conversationId, unifiedMsg);

          setState((prev: Nip29GroupState): Nip29GroupState => {
            if (prev.messages.some((m): boolean => m.id === nextMsg.id)) {
              return prev;
            }
            const newMessages = [nextMsg, ...prev.messages].sort((a, b) => b.created_at - a.created_at).slice(0, 200);
            return { ...prev, messages: newMessages, status: "ready" };
          });
        } catch (e) {
          console.error("Failed to process sealed message:", e);
        }
        return;
      }

      if (event.kind === GROUP_KIND_DELETE) {
        const deletedIds = event.tags.filter(t => t[0] === 'e').map(t => t[1]);
        if (deletedIds.length > 0) {
          setState((prev: Nip29GroupState): Nip29GroupState => ({
            ...prev,
            messages: prev.messages.filter((m) => !deletedIds.includes(m.id)),
          }));
        }
        return;
      }

      if (event.kind === GROUP_KIND_METADATA) {
        try {
          const metadata = JSON.parse(event.content);
          setState(prev => ({
            ...prev,
            metadata: { ...prev.metadata, ...metadata, id: params.groupId }
          }));
        } catch {
          // ignore invalid metadata JSON
        }
        return;
      }

      if (event.kind === GROUP_KIND_MEMBERS) {
        // Only use the relay roster as a seed when we have no live member data yet.
        // Sealed Communities are registry-independent; live join/leave events are
        // the authoritative source. Overwriting with a stale 39002 roster would
        // undo already-processed join/leave state.
        setMembers(prev => {
          if (prev.length > 0) return prev;
          return event.tags
            .filter(t => t[0] === 'p')
            .map(t => t[1] as PublicKeyHex)
            .filter(pk => !leftMembersRef.current.includes(pk) && !expelledMembersRef.current.includes(pk));
        });
        return;
      }
    };

    const timelineSubId = params.pool.subscribe([{
      kinds: [GROUP_KIND_SEALED, GROUP_KIND_DELETE, GROUP_KIND_METADATA, GROUP_KIND_MEMBERS],
      "#h": [params.groupId],
      limit: 100
    }], onEvent);

    queueMicrotask((): void => {
      setState((prev: Nip29GroupState): Nip29GroupState => ({ ...prev, status: "ready" }));
    });

    return (): void => {
      params.pool.unsubscribe(timelineSubId);
    };
  }, [params.groupId, params.pool, params.relayUrl, params.enabled]);

  const refresh = useCallback((): void => {
    // Refresh logic here if needed
  }, []);

  const publishToCommunityScope = useCallback(async (event: NostrEvent): Promise<MultiRelayPublishResult> => {
    const payload = JSON.stringify(["EVENT", event]);
    if (params.relayUrl.trim().length === 0) {
      return params.pool.publishToAll(payload);
    }

    if (typeof params.pool.publishToUrls === "function") {
      return params.pool.publishToUrls([params.relayUrl], payload);
    }
    if (typeof params.pool.publishToUrl === "function") {
      const result = await params.pool.publishToUrl(params.relayUrl, payload);
      return {
        success: result.success,
        successCount: result.success ? 1 : 0,
        totalRelays: 1,
        results: [result],
        overallError: result.success ? undefined : (result.error ?? "Scoped publish failed")
      };
    }
    if (typeof params.pool.publishToRelay === "function") {
      const result = await params.pool.publishToRelay(params.relayUrl, payload);
      return {
        success: result.success,
        successCount: result.success ? 1 : 0,
        totalRelays: 1,
        results: [result],
        overallError: result.success ? undefined : (result.error ?? "Scoped publish failed")
      };
    }
    return params.pool.publishToAll(payload);
  }, [params.pool, params.relayUrl]);

  const sendMessage = useCallback(async (msgParams: Readonly<{ content: string }>): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) return;
    try {
      const { roomKeyStore } = await import("../../crypto/room-key-store");
      const roomKeyHex = await roomKeyStore.getRoomKey(params.groupId);
      if (!roomKeyHex) throw new Error("Missing Room Key");

      const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);
      const signedEvent = await groupService.sendSealedMessage({
        groupId: params.groupId,
        roomKeyHex,
        content: msgParams.content
      });

      const publishResult = await publishToCommunityScope(signedEvent);
      if (!publishResult.success) {
        throw new Error(publishResult.overallError || "Failed to publish to community relay scope");
      }

      // Optimistic update
      const optimisticMsg: GroupMessageEvent = {
        id: signedEvent.id,
        pubkey: params.myPublicKeyHex,
        created_at: Math.floor(Date.now() / 1000),
        content: msgParams.content
      };

      setState((prev: Nip29GroupState): Nip29GroupState => {
        if (prev.messages.some((m): boolean => m.id === optimisticMsg.id)) {
          return prev;
        }
        const newMessages = [optimisticMsg, ...prev.messages].sort((a, b) => b.created_at - a.created_at).slice(0, 200);

        // Emit optimistic message to MessageBus
        const unifiedOptimistic: Message = {
          id: optimisticMsg.id,
          kind: 'user',
          content: optimisticMsg.content,
          timestamp: new Date(optimisticMsg.created_at * 1000),
          isOutgoing: true,
          status: 'sending',
          senderPubkey: params.myPublicKeyHex as PublicKeyHex,
          conversationId
        };
        messageBus.emitNewMessage(conversationId, unifiedOptimistic);

        return { ...prev, messages: newMessages };
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to send message");
    }
  }, [conversationId, params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, publishToCommunityScope]);

  const sendVoteKick = useCallback(async (targetPubkey: string, reason?: string): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) return;
    try {
      const { roomKeyStore } = await import("../../crypto/room-key-store");
      const roomKeyHex = await roomKeyStore.getRoomKey(params.groupId);
      if (!roomKeyHex) throw new Error("Missing Room Key");

      const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);
      const signedEvent = await groupService.sendSealedVote({
        groupId: params.groupId,
        roomKeyHex,
        type: "kick",
        targetPubkey,
        reason
      });

      const publishResult = await publishToCommunityScope(signedEvent);
      if (!publishResult.success) {
        throw new Error(publishResult.overallError || "Failed to publish to community relay scope");
      }
      toast.success("Vote to kick published");
    } catch (e: any) {
      toast.error(e.message || "Failed to publish vote");
    }
  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, publishToCommunityScope]);

  const rotateRoomKey = useCallback(async (): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) return;
    try {
      const newKey = await cryptoService.generateRoomKey();
      const { roomKeyStore } = await import("../../crypto/room-key-store");
      await roomKeyStore.rotateRoomKey(params.groupId, newKey);

      // Distribute new key to all non-expelled members via NIP-17
      const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);
      const currentMetadata = state.metadata || {
        id: params.groupId,
        name: params.groupId,
        access: "invite-only"
      };

      let count = 0;
      for (const memberPk of members) {
        if (state.expelledMembers.includes(memberPk)) continue;
        if (memberPk === params.myPublicKeyHex) continue;

        const inviteEvent = await groupService.distributeRoomKey({
          recipientPubkey: memberPk,
          groupId: params.groupId,
          roomKeyHex: newKey,
          metadata: currentMetadata,
          relayUrl: params.relayUrl,
          communityId: params.communityId
        });
        await params.pool.publishToAll(JSON.stringify(["EVENT", inviteEvent]));
        count++;
      }

      toast.success(`Room Key rotated and distributed to ${count} members.`);
    } catch (e: any) {
      toast.error(e.message || "Failed to rotate Room Key");
    }
  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, params.pool, members, state.expelledMembers, state.metadata]);

  const leaveGroup = useCallback(async (): Promise<void> => {
    if (params.myPublicKeyHex && params.myPrivateKeyHex) {
      try {
        const { roomKeyStore } = await import("../../crypto/room-key-store");
        const roomKeyHex = await roomKeyStore.getRoomKey(params.groupId);
        const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);

        // 1. Tell the RELAY directly (NIP-29 Kind 9022)
        const nip29Leave = await groupService.sendNip29Leave({ groupId: params.groupId });
        const nip29LeaveResult = await publishToCommunityScope(nip29Leave);
        if (!nip29LeaveResult.success) {
          throw new Error(nip29LeaveResult.overallError || "Failed to publish leave to community relay scope");
        }

        // 2. Tell other CLIENTS via sealed channel (Kind 10105)
        if (roomKeyHex) {
          const signedEvent = await groupService.sendSealedLeave({
            groupId: params.groupId,
            roomKeyHex
          });
          const sealedLeaveResult = await publishToCommunityScope(signedEvent);
          if (!sealedLeaveResult.success) {
            throw new Error(sealedLeaveResult.overallError || "Failed to publish sealed leave to community relay scope");
          }
        }
      } catch (e) {
        console.error("Failed to broadcast leave event(s):", e);
      }
    }
    const { roomKeyStore } = await import("../../crypto/room-key-store");
    await roomKeyStore.deleteRoomKey(params.groupId);
    toast.success("Disconnected from community");
  }, [params.groupId, params.myPublicKeyHex, params.myPrivateKeyHex, publishToCommunityScope]);

  const deleteMessage = useCallback(async (deleteParams: Readonly<{ eventId: string; reason?: string }>): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) return;
    const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);
    const deletionEvent = await groupService.hideMessage({
      groupId: params.groupId,
      eventId: deleteParams.eventId,
      reason: deleteParams.reason
    });
    const deletionResult = await publishToCommunityScope(deletionEvent);
    if (!deletionResult.success) {
      throw new Error(deletionResult.overallError || "Failed to publish delete to community relay scope");
    }
    setState(prev => ({
      ...prev,
      messages: prev.messages.filter(m => m.id !== deleteParams.eventId)
    }));
  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, publishToCommunityScope]);

  const noop = async () => { };
  const updateMetadata = noop;
  const setGroupStatus = noop;
  const requestJoin = useCallback(async (): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) return;
    try {
      const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);
      const joinEvent = await groupService.sendNip29Join({ groupId: params.groupId });
      const joinResult = await publishToCommunityScope(joinEvent);
      if (!joinResult.success) {
        throw new Error(joinResult.overallError || "Failed to publish join request to community relay scope");
      }
      toast.success("Join request sent to relay");
    } catch (e: any) {
      toast.error(e.message || "Failed to send join request");
    }
  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, publishToCommunityScope]);
  const approveJoin = noop;
  const denyJoin = noop;
  const approveAllJoinRequests = noop;
  const denyAllJoinRequests = noop;
  const putUser = noop;
  const removeUser = noop;
  const promoteUser = noop;
  const demoteUser = noop;

  const result: UseSealedCommunityResult = useMemo((): UseSealedCommunityResult => {
    return {
      state,
      refresh,
      requestJoin,
      approveJoin,
      denyJoin,
      approveAllJoinRequests,
      denyAllJoinRequests,
      sendMessage,
      sendVoteKick,
      rotateRoomKey,
      updateMetadata,
      setGroupStatus,
      putUser,
      removeUser,
      promoteUser,
      demoteUser,
      leaveGroup,
      deleteMessage,
      members,
      admins: []
    };
  }, [state, refresh, requestJoin, approveJoin, denyJoin, approveAllJoinRequests, denyAllJoinRequests, sendMessage, sendVoteKick, rotateRoomKey, updateMetadata, setGroupStatus, putUser, removeUser, promoteUser, demoteUser, leaveGroup, deleteMessage, members]);

  return result;
};
