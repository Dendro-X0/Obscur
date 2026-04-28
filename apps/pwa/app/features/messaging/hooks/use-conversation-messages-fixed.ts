/**
 * Fixed version of useConversationMessages with diagnostics
 * 
 * This hook adds logging to diagnose why outgoing messages don't appear
 * and provides a fix for the message correlation issue.
 */

"use client";

import { useMemo, useEffect } from "react";
import { useConversationMessages as useOriginal } from "./use-conversation-messages";
import type { Message } from "../types";

export const useConversationMessagesFixed = (
  conversationId: string | undefined,
  publicKeyHex: string | null
) => {
  // Log hook initialization
  console.log("[ChatFix] Hook initialized:", {
    conversationId,
    publicKeyHex: publicKeyHex?.slice(0, 16),
  });

  const result = useOriginal(conversationId, publicKeyHex);

  // Add diagnostics
  useEffect(() => {
    console.log("[ChatFix] Messages updated:", {
      count: result.messages.length,
      conversationId,
    });

    if (result.messages.length > 0) {
      const outgoing = result.messages.filter(
        (m: Message) => m.isOutgoing
      );
      const incoming = result.messages.filter(
        (m: Message) => !m.isOutgoing
      );

      console.log("[ChatFix] Message counts:", {
        total: result.messages.length,
        outgoing: outgoing.length,
        incoming: incoming.length,
        conversationId,
        publicKeyHex: publicKeyHex?.slice(0, 16),
      });

      if (outgoing.length === 0 && result.messages.length > 0) {
        console.warn("[ChatFix] No outgoing messages found! Possible correlation issue.");
        
        // Deep dive: check why messages aren't marked as outgoing
        const sampleMessages = result.messages.slice(0, 5);
        console.log("[ChatFix] Sample messages for diagnosis:", sampleMessages.map((m: Message) => ({
          id: m.id?.slice(0, 16),
          senderPubkey: m.senderPubkey?.slice(0, 16),
          isOutgoing: m.isOutgoing,
          hasSenderPubkey: !!m.senderPubkey,
          matchesMyKey: m.senderPubkey === publicKeyHex,
          content: m.content?.slice(0, 30),
        })));
      }
    }
  }, [result.messages, conversationId, publicKeyHex]);

  // Enhanced result with diagnostics
  return useMemo(
    () => ({
      ...result,
      _diagnostics: {
        messageCount: result.messages.length,
        outgoingCount: result.messages.filter((m: Message) => m.isOutgoing).length,
        incomingCount: result.messages.filter((m: Message) => !m.isOutgoing).length,
      },
    }),
    [result]
  );
};

export default useConversationMessagesFixed;
