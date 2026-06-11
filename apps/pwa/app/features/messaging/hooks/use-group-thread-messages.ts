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
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
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

  const conversationId = conversation?.id;
  const groupId = conversation?.groupId;
  const communityId = conversation?.communityId;
  const workspaceKernelThread = isWorkspaceKernelAuthority();

  const hydrateLatest = useCallback(async () => {
    if (!conversationId || !publicKeyHex) {
      setMessages([]);
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
      setHasEarlier(page.hasEarlier);
    } finally {
      setIsLoading(false);
    }
  }, [communityId, conversationId, groupId, publicKeyHex, workspaceKernelThread]);

  useEffect(() => {
    void hydrateLatest();
  }, [hydrateLatest]);

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
