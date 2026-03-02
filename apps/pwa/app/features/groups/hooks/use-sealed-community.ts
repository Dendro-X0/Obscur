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
  transitionCommunityConnection,
  transitionMembershipStatus
} from "../../messaging/state-machines/community-membership-machine";
import { messageBus } from "../../messaging/services/message-bus";
import type { Message } from "../../messaging/types";

type NostrPool = Readonly<{
  sendToOpen: (payload: string) => void;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
  subscribe: (filters: ReadonlyArray<NostrFilter>, onEvent: (event: NostrEvent, url: string) => void) => string;
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
}>;

type UseSealedCommunityParams = Readonly<{
  pool: NostrPool;
  relayUrl: string;
  groupId: string;
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
  const membersRef = useRef<ReadonlyArray<PublicKeyHex>>(params.initialMembers ?? []);
  const leftMembersRef = useRef<ReadonlyArray<PublicKeyHex>>(state.leftMembers);
  const expelledMembersRef = useRef<ReadonlyArray<PublicKeyHex>>(state.expelledMembers);
  const latestStatusTimestamp = useRef<Record<string, number>>({});

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    leftMembersRef.current = state.leftMembers;
    expelledMembersRef.current = state.expelledMembers;
  }, [state.leftMembers, state.expelledMembers]);

  useEffect((): (() => void) => {
    if (!params.relayUrl || !params.groupId || params.enabled === false) {
      return (): void => { };
    }

    // Auto-membership: In the Sealed Protocol, if you have the key, you are a member
    setState(prev => {
      const nextConn = transitionCommunityConnection(prev.status, { type: "START_LOAD" });
      const nextMem = transitionMembershipStatus(prev.membership.status, { type: "JOIN_SUCCESS" });
      return { ...prev, status: nextConn, membership: { ...prev.membership, status: nextMem } };
    });

    const onEvent = async (event: NostrEvent, url: string): Promise<void> => {
      if (url !== params.relayUrl) return;

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
            return;
          }

          const innerPayload = JSON.parse(decryptedPayload);

          // Consensus Moderation: Handle Votes
          if (innerPayload.type === "vote-kick") {
            const target = innerPayload.target as PublicKeyHex;
            const voter = innerPayload.pubkey as PublicKeyHex;

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
              const expelledMembers = [...prev.expelledMembers];
              if (targetVotes.length >= 2 && targetVotes.length > threshold && !expelledMembers.includes(target)) {
                expelledMembers.push(target);
                toast.error(`Consensus reached: Member ${target.slice(0, 8)}... has been expelled.`);
              }

              return { ...prev, kickVotes: currentVotes, expelledMembers };
            });
            return;
          }

          // Handle explicit leaving
          if (innerPayload.type === "leave") {
            const leaver = innerPayload.pubkey as PublicKeyHex;
            const ts = innerPayload.created_at || event.created_at;

            // Only update status if this event is newer than what we've already processed for this user
            if (ts >= (latestStatusTimestamp.current[leaver] || 0)) {
              latestStatusTimestamp.current[leaver] = ts;
              setState(prev => {
                if (prev.leftMembers.includes(leaver)) return prev;
                const leftMembers = [...prev.leftMembers, leaver];

                let nextStatus = prev.status;
                let nextMembership = prev.membership;

                if (leaver === params.myPublicKeyHex) {
                  nextStatus = transitionCommunityConnection(prev.status, { type: "LEAVE" } as any);
                  nextMembership = { ...prev.membership, status: transitionMembershipStatus(prev.membership.status, { type: "LEAVE" }) };
                }

                return { ...prev, leftMembers, status: nextStatus, membership: nextMembership };
              });

              // Remove from active members
              setMembers(prev => prev.filter(m => m !== leaver));
            }
            return;
          }

          // Handle explicit joining (from NIP-17 invites)
          if (innerPayload.type === "join") {
            const joiner = innerPayload.pubkey as PublicKeyHex;
            const ts = innerPayload.created_at || event.created_at;

            if (ts >= (latestStatusTimestamp.current[joiner] || 0)) {
              latestStatusTimestamp.current[joiner] = ts;
              setMembers(prev => {
                if (prev.includes(joiner)) return prev;
                return [...prev, joiner];
              });
              setState(prev => {
                let nextStatus = prev.status;
                let nextMembership = prev.membership;

                if (joiner === params.myPublicKeyHex) {
                  nextStatus = transitionCommunityConnection(prev.status, { type: "JOIN_SUCCESS" } as any);
                  nextMembership = { ...prev.membership, status: transitionMembershipStatus(prev.membership.status, { type: "JOIN_SUCCESS" }) };
                }

                return {
                  ...prev,
                  leftMembers: prev.leftMembers.filter(pk => pk !== joiner),
                  expelledMembers: prev.expelledMembers.filter(pk => pk !== joiner),
                  status: nextStatus,
                  membership: nextMembership
                };
              });
            }
            return;
          }

          // Anti-Injection: Filter messages from expelled/left members
          // Use refs (not state) to avoid stale closure inside the async onEvent callback
          if (
            expelledMembersRef.current.includes(innerPayload.pubkey as PublicKeyHex) ||
            leftMembersRef.current.includes(innerPayload.pubkey as PublicKeyHex)
          ) {
            console.info(`Filtering message from expelled/left member: ${innerPayload.pubkey}`);
            return;
          }

          const nextMsg: GroupMessageEvent = {
            id: event.id,
            pubkey: innerPayload.pubkey || event.pubkey,
            created_at: innerPayload.created_at || event.created_at,
            content: innerPayload.content
          };

          // Auto-rehabilitate: If this user was previously marked as left, remove them
          // ONLY if this message is chronologically newer than the leave event
          const author = nextMsg.pubkey as PublicKeyHex;
          const msgTs = nextMsg.created_at;

          if (msgTs >= (latestStatusTimestamp.current[author] || 0)) {
            // Update threshold tracker anyway
            latestStatusTimestamp.current[author] = msgTs;

            setState(prev => {
              if (!prev.leftMembers.includes(author)) return prev;
              return {
                ...prev,
                leftMembers: prev.leftMembers.filter(pk => pk !== author)
              };
            });

            // Add back to members roster if not already present
            setMembers(prev => {
              if (prev.includes(author)) return prev;
              return [...prev, author];
            });
          }

          // Emit to MessageBus for localized listeners
          const unifiedMsg: Message = {
            id: event.id,
            kind: 'user',
            content: innerPayload.content,
            timestamp: new Date(nextMsg.created_at * 1000),
            isOutgoing: (author === params.myPublicKeyHex),
            status: 'delivered',
            senderPubkey: author,
            conversationId: params.groupId
          };
          messageBus.emitNewMessage(params.groupId, unifiedMsg);

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

      await params.pool.publishToAll(JSON.stringify(["EVENT", signedEvent]));

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
          conversationId: params.groupId
        };
        messageBus.emitNewMessage(params.groupId, unifiedOptimistic);

        return { ...prev, messages: newMessages };
      });
    } catch (e: any) {
      toast.error(e.message || "Failed to send message");
    }
  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, params.pool]);

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

      await params.pool.publishToAll(JSON.stringify(["EVENT", signedEvent]));
      toast.success("Vote to kick published");
    } catch (e: any) {
      toast.error(e.message || "Failed to publish vote");
    }
  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, params.pool]);

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
          relayUrl: params.relayUrl
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
        await params.pool.publishToAll(JSON.stringify(["EVENT", nip29Leave]));

        // 2. Tell other CLIENTS via sealed channel (Kind 10105)
        if (roomKeyHex) {
          const signedEvent = await groupService.sendSealedLeave({
            groupId: params.groupId,
            roomKeyHex
          });
          await params.pool.publishToAll(JSON.stringify(["EVENT", signedEvent]));
        }
      } catch (e) {
        console.error("Failed to broadcast leave event(s):", e);
      }
    }
    const { roomKeyStore } = await import("../../crypto/room-key-store");
    await roomKeyStore.deleteRoomKey(params.groupId);
    toast.success("Disconnected from community");
  }, [params.groupId, params.myPublicKeyHex, params.myPrivateKeyHex, params.pool]);

  const deleteMessage = useCallback(async (deleteParams: Readonly<{ eventId: string; reason?: string }>): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) return;
    const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);
    const deletionEvent = await groupService.hideMessage({
      groupId: params.groupId,
      eventId: deleteParams.eventId,
      reason: deleteParams.reason
    });
    await params.pool.publishToAll(JSON.stringify(["EVENT", deletionEvent]));
    setState(prev => ({
      ...prev,
      messages: prev.messages.filter(m => m.id !== deleteParams.eventId)
    }));
  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, params.pool]);

  const noop = async () => { };
  const updateMetadata = noop;
  const setGroupStatus = noop;
  const requestJoin = useCallback(async (): Promise<void> => {
    if (!params.myPublicKeyHex || !params.myPrivateKeyHex) return;
    try {
      const groupService = new GroupService(params.myPublicKeyHex, params.myPrivateKeyHex);
      const joinEvent = await groupService.sendNip29Join({ groupId: params.groupId });
      await params.pool.publishToAll(JSON.stringify(["EVENT", joinEvent]));
      toast.success("Join request sent to relay");
    } catch (e: any) {
      toast.error(e.message || "Failed to send join request");
    }
  }, [params.groupId, params.myPrivateKeyHex, params.myPublicKeyHex, params.pool]);
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
