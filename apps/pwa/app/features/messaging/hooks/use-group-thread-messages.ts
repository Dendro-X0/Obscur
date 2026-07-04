"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GroupConversation, Message } from "../types";
import {
  loadDmKernelGroupThreadEarlier,
  loadDmKernelGroupThreadPage,
} from "@/app/features/dm-kernel/dm-kernel-group-thread-port";
import {
  loadWorkspaceKernelGroupThreadEarlier,
  loadWorkspaceKernelGroupThreadPage,
} from "@/app/features/workspace-kernel/workspace-kernel-thread-port";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";
import { subscribeGroupThreadMessagesChanged } from "../services/thread-history/group-thread-messages-changed";
import { messageBus } from "../services/message-bus";
import { collectMessageIdentityAliases } from "../services/message-identity-alias-contract";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { DESKTOP_PROFILE_BOOT_RECONCILED_EVENT } from "@/app/features/profiles/services/desktop-window-boot";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import {
  NATIVE_DM_THREAD_STALE_EMPTY_HYDRATE_BASE_DELAY_MS,
  NATIVE_DM_THREAD_STALE_EMPTY_HYDRATE_MAX_ATTEMPTS,
} from "@/app/features/messaging/services/thread-history/read-model";
import { THREAD_HISTORY_DEFAULT_PAGE_SIZE } from "../services/thread-history/contracts";
import type { UseThreadMessagesResult } from "./use-thread-messages";

export function useGroupThreadMessages(
  conversation: GroupConversation | null | undefined,
  publicKeyHex: string | null,
): UseThreadMessagesResult {
  const [messages, setMessages] = useState<ReadonlyArray<Message>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasEarlier, setHasEarlier] = useState(false);
  const loadEarlierInFlightRef = useRef(false);
  const staleEmptyHydrateAttemptRef = useRef(0);
  const messagesRef = useRef<ReadonlyArray<Message>>([]);

  const conversationId = conversation?.id;
  const groupId = conversation?.groupId;
  const communityId = conversation?.communityId;
  const workspaceKernelThread = isWorkspaceKernelAuthority();

  const hydrateLatest = useCallback(async () => {
    if (!conversationId || !publicKeyHex) {
      setMessages([]);
      messagesRef.current = [];
      setHasEarlier(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const loadPage = workspaceKernelThread
        ? loadWorkspaceKernelGroupThreadPage
        : loadDmKernelGroupThreadPage;
      const page = await loadPage({
        conversationId,
        groupId,
        communityId,
        myPublicKeyHex: publicKeyHex,
        pageSize: THREAD_HISTORY_DEFAULT_PAGE_SIZE,
      });
      setMessages(page.messages);
      messagesRef.current = page.messages;
      setHasEarlier(page.hasEarlier);
    } finally {
      setIsLoading(false);
    }
  }, [communityId, conversationId, groupId, publicKeyHex, workspaceKernelThread]);

  useEffect(() => {
    staleEmptyHydrateAttemptRef.current = 0;
    messagesRef.current = [];
  }, [conversationId]);

  useEffect(() => {
    void hydrateLatest();
  }, [hydrateLatest]);

  useEffect(() => {
    if (!requiresSqlitePersistence() || !conversationId || isLoading || messagesRef.current.length > 0) {
      return;
    }
    if (staleEmptyHydrateAttemptRef.current >= NATIVE_DM_THREAD_STALE_EMPTY_HYDRATE_MAX_ATTEMPTS) {
      return;
    }
    const delayMs = NATIVE_DM_THREAD_STALE_EMPTY_HYDRATE_BASE_DELAY_MS * (staleEmptyHydrateAttemptRef.current + 1);
    const timer = window.setTimeout(() => {
      staleEmptyHydrateAttemptRef.current += 1;
      void hydrateLatest();
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [conversationId, hydrateLatest, isLoading, messages.length]);

  useEffect(() => {
    if (!requiresSqlitePersistence() || !conversationId) {
      return;
    }
    const onProfileBootReconciled = (): void => {
      if (messagesRef.current.length > 0) {
        return;
      }
      staleEmptyHydrateAttemptRef.current = 0;
      void hydrateLatest();
    };
    window.addEventListener(DESKTOP_PROFILE_BOOT_RECONCILED_EVENT, onProfileBootReconciled);
    return () => window.removeEventListener(DESKTOP_PROFILE_BOOT_RECONCILED_EVENT, onProfileBootReconciled);
  }, [conversationId, hydrateLatest]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }
    return subscribeGroupThreadMessagesChanged((detail) => {
      if (detail.conversationId !== conversationId) {
        return;
      }
      const activeProfileId = getResolvedProfileId()?.trim();
      if (activeProfileId && detail.profileId !== activeProfileId) {
        return;
      }
      void hydrateLatest();
    });
  }, [conversationId, hydrateLatest]);

  useEffect(() => {
    if (!conversationId) {
      return;
    }
    const activeProfileId = getResolvedProfileId()?.trim();
    return messageBus.subscribe((event) => {
      if (event.type !== "message_deleted" || event.conversationId !== conversationId) {
        return;
      }
      if (event.messageId === "all") {
        setMessages([]);
        messagesRef.current = [];
        return;
      }
      const deleteIds = new Set(
        (event.messageIdentityIds?.length ? event.messageIdentityIds : [event.messageId])
          .map((id) => id.trim())
          .filter((id) => id.length > 0),
      );
      if (deleteIds.size === 0) {
        return;
      }
      setMessages((current) => current.filter((message) => (
        !collectMessageIdentityAliases(message).some((alias) => deleteIds.has(alias))
      )));
    }, activeProfileId ? { profileId: activeProfileId } : undefined);
  }, [conversationId]);

  const loadEarlier = useCallback(async () => {
    if (!conversationId || !publicKeyHex || !hasEarlier || loadEarlierInFlightRef.current) {
      return;
    }
    const earliest = messages[0];
    if (!earliest) {
      return;
    }
    loadEarlierInFlightRef.current = true;
    try {
      const loadEarlier = workspaceKernelThread
        ? loadWorkspaceKernelGroupThreadEarlier
        : loadDmKernelGroupThreadEarlier;
      const page = await loadEarlier({
        conversationId,
        groupId,
        communityId,
        myPublicKeyHex: publicKeyHex,
        existingMessages: messages,
        beforeReceivedAtMs: earliest.timestamp.getTime(),
        pageSize: THREAD_HISTORY_DEFAULT_PAGE_SIZE,
      });
      setMessages(page.messages);
      setHasEarlier(page.hasEarlier);
    } finally {
      loadEarlierInFlightRef.current = false;
    }
  }, [communityId, conversationId, groupId, hasEarlier, messages, publicKeyHex, workspaceKernelThread]);

  return {
    messages,
    isLoading,
    hasEarlier,
    loadEarlier,
    pendingEventCount: 0,
    hasHydrated: !isLoading,
  };
}
