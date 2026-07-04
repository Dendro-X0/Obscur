"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { messageBus } from "@/app/features/messaging/services/message-bus";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { DESKTOP_PROFILE_BOOT_RECONCILED_EVENT } from "@/app/features/profiles/services/desktop-window-boot";
import { useOptionalProfileRuntime } from "@/app/features/profiles/providers/profile-runtime-provider";
import {
  NATIVE_DM_THREAD_STALE_EMPTY_HYDRATE_BASE_DELAY_MS,
  NATIVE_DM_THREAD_STALE_EMPTY_HYDRATE_MAX_ATTEMPTS,
} from "@/app/features/messaging/services/thread-history/read-model";
import type { Message } from "@/app/features/messaging/types";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { subscribeNativeDmRelayBackfillRepair } from "@/app/features/messaging/services/native-dm-sqlite-repair";
import { DM_KERNEL_PAGE_SIZE, loadDmKernelThread } from "./dm-kernel-thread-port";
import { logDmKernelOneSidedIfNeeded } from "./dm-kernel-integrity";
import { invalidateDmKernelThreadSessionCache } from "./dm-kernel-thread-session-cache";
import { buildDmSiblingConversationIds, inferPeerFromConversationId } from "@/app/features/messaging/utils/dm-conversation-sibling-ids";
import {
  doesLiveDmBusEventBelongToThread,
  findThreadMessageIndexByIdentity,
  mergeDmKernelThreadMessages,
  messagesAreEquivalentForThread,
  upsertDmKernelThreadMessage,
} from "./dm-kernel-live-bus-match";
import {
  buildCommunityInviteThreadDisplayBundle,
  COMMUNITY_DM_INVITE_LEDGER_CHANGED_EVENT,
  syncCommunityDmInviteLedgerFromInboundMessage,
} from "@/app/features/groups/services/community-dm-invite-pipeline";
import type { InviteResponseStatus } from "@/app/features/messaging/components/message-list-render-meta";

export type UseDmKernelThreadResult = Readonly<{
  messages: ReadonlyArray<Message>;
  inviteResponseStatusByMessageId: ReadonlyMap<string, InviteResponseStatus>;
  isLoading: boolean;
  hasEarlier: boolean;
  loadEarlier: () => Promise<void>;
  pendingEventCount: number;
  hasHydrated: boolean;
}>;

const EMPTY_INVITE_STATUS_MAP: ReadonlyMap<string, InviteResponseStatus> = new Map();

const EMPTY_MESSAGES: ReadonlyArray<Message> = [];

const messageIdentityKeys = (message: Message): ReadonlyArray<string> => (
  [message.id, message.eventId]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
);

const trackMessageIdentity = (
  trackedIds: Set<string>,
  message: Message,
): void => {
  for (const id of messageIdentityKeys(message)) {
    trackedIds.add(id);
  }
};

/**
 * v2 slim DM thread — one SQLite load per conversation, then messageBus append-only.
 * Never re-runs hydrate pipeline or replaces the full list after initial load.
 */
export function useDmKernelThread(
  conversationId: string | undefined,
  myPublicKeyHex: string | null,
): UseDmKernelThreadResult {
  const [messages, setMessages] = useState<ReadonlyArray<Message>>(EMPTY_MESSAGES);
  const [isLoading, setIsLoading] = useState(false);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [pendingEventCount, setPendingEventCount] = useState(0);
  const [inviteLedgerEpoch, setInviteLedgerEpoch] = useState(0);
  const messageIdsRef = useRef(new Set<string>());
  const oldestReceivedAtRef = useRef<number | null>(null);
  const integrityCheckedRef = useRef(false);
  const loadedConversationIdRef = useRef<string | null>(null);
  const staleEmptyHydrateAttemptRef = useRef(0);
  const messagesRef = useRef<ReadonlyArray<Message>>(EMPTY_MESSAGES);

  const optionalProfileRuntime = useOptionalProfileRuntime();
  const profileId = optionalProfileRuntime?.profileId ?? getResolvedProfileId();
  const normalizedMyPublicKeyHex = useMemo((): PublicKeyHex | null => (
    myPublicKeyHex
      ? (normalizePublicKeyHex(myPublicKeyHex) ?? (myPublicKeyHex as PublicKeyHex))
      : null
  ), [myPublicKeyHex]);

  const conversationAliasIdSet = useMemo(() => {
    if (!conversationId || !normalizedMyPublicKeyHex) {
      return new Set<string>();
    }
    return new Set(buildDmSiblingConversationIds({
      conversationId,
      myPublicKeyHex: normalizedMyPublicKeyHex,
    }));
  }, [conversationId, normalizedMyPublicKeyHex]);

  const threadContextRef = useRef({
    conversationId,
    conversationAliasIdSet,
    myPublicKeyHex: normalizedMyPublicKeyHex,
    profileId,
  });
  threadContextRef.current = {
    conversationId,
    conversationAliasIdSet,
    myPublicKeyHex: normalizedMyPublicKeyHex,
    profileId,
  };

  const recordLoadedMessages = (next: ReadonlyArray<Message>): void => {
    messageIdsRef.current = new Set(
      next.flatMap((message) => messageIdentityKeys(message)),
    );
    oldestReceivedAtRef.current = next.length > 0
      ? Math.min(...next.map((message) => message.timestamp.getTime()))
      : null;
  };

  const logIntegrityOnce = (next: ReadonlyArray<Message>): void => {
    if (integrityCheckedRef.current || !conversationId || !myPublicKeyHex) {
      return;
    }
    integrityCheckedRef.current = true;
    const peerPubkey = inferPeerFromConversationId({ conversationId, myPublicKeyHex }) ?? undefined;
    logDmKernelOneSidedIfNeeded({
      conversationId,
      messages: next,
      myPublicKeyHex,
      profileId,
      peerPubkey,
    });
  };

  const reloadThreadFromSqlite = useCallback(async (): Promise<void> => {
    if (!conversationId || !myPublicKeyHex) {
      return;
    }
    const loaded = await loadDmKernelThread({
      profileId,
      conversationId,
      myPublicKeyHex,
      limit: DM_KERNEL_PAGE_SIZE,
    });
    setMessages((current) => {
      const merged = mergeDmKernelThreadMessages(loaded, current);
      recordLoadedMessages(merged);
      messagesRef.current = merged;
      logIntegrityOnce(merged);
      if (conversationId?.trim() && normalizedMyPublicKeyHex) {
        merged.forEach((message) => {
          syncCommunityDmInviteLedgerFromInboundMessage({
            message,
            conversationId: conversationId.trim(),
            accountPublicKeyHex: normalizedMyPublicKeyHex,
            profileId,
          });
        });
      }
      return merged;
    });
    setHasEarlier(loaded.length >= DM_KERNEL_PAGE_SIZE);
  }, [conversationId, myPublicKeyHex, normalizedMyPublicKeyHex, profileId]);

  useEffect(() => {
    integrityCheckedRef.current = false;
    if (!conversationId || !myPublicKeyHex) {
      loadedConversationIdRef.current = null;
      setMessages(EMPTY_MESSAGES);
      messageIdsRef.current = new Set();
      oldestReceivedAtRef.current = null;
      setIsLoading(false);
      setHasEarlier(false);
      return;
    }

    const conversationChanged = loadedConversationIdRef.current !== conversationId;
    loadedConversationIdRef.current = conversationId;
    if (conversationChanged) {
      setMessages(EMPTY_MESSAGES);
      messagesRef.current = EMPTY_MESSAGES;
      messageIdsRef.current = new Set();
      oldestReceivedAtRef.current = null;
      staleEmptyHydrateAttemptRef.current = 0;
    }

    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      try {
        if (cancelled) {
          return;
        }
        await reloadThreadFromSqlite();
      } catch {
        if (!cancelled) {
          setMessages(EMPTY_MESSAGES);
          messagesRef.current = EMPTY_MESSAGES;
          recordLoadedMessages(EMPTY_MESSAGES);
          setHasEarlier(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, myPublicKeyHex, profileId, reloadThreadFromSqlite]);

  useEffect(() => {
    if (!conversationId || !myPublicKeyHex || isLoading) {
      return;
    }
    if (messagesRef.current.length > 0) {
      return;
    }
    if (staleEmptyHydrateAttemptRef.current >= NATIVE_DM_THREAD_STALE_EMPTY_HYDRATE_MAX_ATTEMPTS) {
      return;
    }
    const delayMs = NATIVE_DM_THREAD_STALE_EMPTY_HYDRATE_BASE_DELAY_MS * (staleEmptyHydrateAttemptRef.current + 1);
    const timer = window.setTimeout(() => {
      staleEmptyHydrateAttemptRef.current += 1;
      invalidateDmKernelThreadSessionCache(profileId, conversationId);
      integrityCheckedRef.current = false;
      void reloadThreadFromSqlite();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [conversationId, isLoading, messages.length, myPublicKeyHex, profileId, reloadThreadFromSqlite]);

  useEffect(() => {
    if (!conversationId || !myPublicKeyHex) {
      return;
    }
    const onProfileBootReconciled = (): void => {
      if (messagesRef.current.length > 0) {
        return;
      }
      staleEmptyHydrateAttemptRef.current = 0;
      invalidateDmKernelThreadSessionCache(profileId, conversationId);
      integrityCheckedRef.current = false;
      void reloadThreadFromSqlite();
    };
    window.addEventListener(DESKTOP_PROFILE_BOOT_RECONCILED_EVENT, onProfileBootReconciled);
    return () => window.removeEventListener(DESKTOP_PROFILE_BOOT_RECONCILED_EVENT, onProfileBootReconciled);
  }, [conversationId, myPublicKeyHex, profileId, reloadThreadFromSqlite]);

  useEffect(() => {
    if (!conversationId || !profileId.trim()) {
      return;
    }

    return subscribeNativeDmRelayBackfillRepair((detail) => {
      if (detail.profileId !== profileId) {
        return;
      }
      const targetsActiveConversation = detail.conversationIds.some((id) => (
        conversationAliasIdSet.has(id.trim())
        || id.trim() === conversationId.trim()
      ));
      if (!targetsActiveConversation) {
        return;
      }
      invalidateDmKernelThreadSessionCache(profileId, conversationId);
      integrityCheckedRef.current = false;
      void reloadThreadFromSqlite();
    });
  }, [conversationAliasIdSet, conversationId, profileId, reloadThreadFromSqlite]);

  useEffect(() => {
    if (!conversationId || !normalizedMyPublicKeyHex) {
      return;
    }

    return messageBus.subscribe((event) => {
      const ctx = threadContextRef.current;
      if (!ctx.conversationId || !ctx.myPublicKeyHex) {
        return;
      }
      if (!doesLiveDmBusEventBelongToThread({
        event,
        conversationAliasIdSet: ctx.conversationAliasIdSet,
        conversationId: ctx.conversationId,
        myPublicKeyHex: ctx.myPublicKeyHex,
      })) {
        return;
      }

      if (event.type === "new_message" || event.type === "message_updated") {
        let changed = false;
        setMessages((previous) => {
          const beforeIndex = findThreadMessageIndexByIdentity(previous, event.message);
          const next = upsertDmKernelThreadMessage(previous, event.message);
          const afterIndex = findThreadMessageIndexByIdentity(next, event.message);
          if (
            beforeIndex >= 0
            && afterIndex >= 0
            && messagesAreEquivalentForThread(previous[beforeIndex], next[afterIndex])
          ) {
            return previous;
          }
          if (beforeIndex < 0 && afterIndex < 0) {
            return previous;
          }
          const resolved = afterIndex >= 0 ? next[afterIndex]! : event.message;
          trackMessageIdentity(messageIdsRef.current, resolved);
          if (oldestReceivedAtRef.current == null || resolved.timestamp.getTime() < oldestReceivedAtRef.current) {
            oldestReceivedAtRef.current = resolved.timestamp.getTime();
          }
          changed = true;
          messagesRef.current = next;
          return next;
        });
        if (changed && event.type === "new_message") {
          syncCommunityDmInviteLedgerFromInboundMessage({
            message: event.message,
            conversationId: ctx.conversationId,
            accountPublicKeyHex: ctx.myPublicKeyHex as PublicKeyHex,
            profileId,
          });
          setPendingEventCount((count) => count + 1);
        }
        return;
      }

      if (event.type === "message_deleted") {
        setMessages((previous) => {
          const deleteIds = new Set(
            [event.messageId, ...(event.messageIdentityIds ?? [])]
              .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
          );
          const next = previous.filter((message) => (
            !deleteIds.has(message.id)
            && !(message.eventId && deleteIds.has(message.eventId))
          ));
          for (const id of deleteIds) {
            messageIdsRef.current.delete(id);
          }
          messagesRef.current = next;
          return next;
        });
      }
    }, { profileId });
  }, [conversationId, normalizedMyPublicKeyHex, profileId]);

  useEffect(() => {
    if (!conversationId?.trim() || typeof window === "undefined") {
      return;
    }
    const onLedgerChanged = (event: Event): void => {
      const detail = (event as CustomEvent<{ conversationId?: string; profileId?: string }>).detail;
      if (detail?.conversationId !== conversationId.trim()) {
        return;
      }
      if (detail?.profileId && detail.profileId !== profileId) {
        return;
      }
      setInviteLedgerEpoch((epoch) => epoch + 1);
    };
    window.addEventListener(COMMUNITY_DM_INVITE_LEDGER_CHANGED_EVENT, onLedgerChanged);
    return () => window.removeEventListener(COMMUNITY_DM_INVITE_LEDGER_CHANGED_EVENT, onLedgerChanged);
  }, [conversationId, profileId]);

  const inviteThreadDisplay = useMemo(() => {
    if (!conversationId?.trim()) {
      return {
        messages,
        inviteResponseStatusByMessageId: EMPTY_INVITE_STATUS_MAP,
      };
    }
    return buildCommunityInviteThreadDisplayBundle(
      messages,
      conversationId.trim(),
      profileId || undefined,
      normalizedMyPublicKeyHex,
    );
  }, [conversationId, inviteLedgerEpoch, messages, normalizedMyPublicKeyHex, profileId]);

  const displayMessages = inviteThreadDisplay.messages;
  const inviteResponseStatusByMessageId = inviteThreadDisplay.inviteResponseStatusByMessageId;

  const loadEarlier = useCallback(async () => {
    if (!conversationId || !myPublicKeyHex || oldestReceivedAtRef.current == null) {
      return;
    }

    const earlier = await loadDmKernelThread({
      profileId,
      conversationId,
      myPublicKeyHex,
      limit: DM_KERNEL_PAGE_SIZE,
      beforeReceivedAt: oldestReceivedAtRef.current,
    });

    setMessages((previous) => {
      const byId = new Map<string, Message>();
      for (const message of earlier) {
        byId.set(message.id, message);
      }
      for (const message of previous) {
        byId.set(message.id, message);
      }
      const merged = [...byId.values()]
        .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
      recordLoadedMessages(merged);
      messagesRef.current = merged;
      return merged;
    });
    setHasEarlier(earlier.length >= DM_KERNEL_PAGE_SIZE);
  }, [conversationId, myPublicKeyHex, profileId]);

  return {
    messages: displayMessages,
    inviteResponseStatusByMessageId,
    isLoading,
    hasEarlier,
    loadEarlier,
    pendingEventCount,
    hasHydrated: !isLoading,
  };
}
