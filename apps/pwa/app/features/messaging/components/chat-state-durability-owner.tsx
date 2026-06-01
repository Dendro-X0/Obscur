"use client";

import { useEffect } from "react";
import { chatStateStoreService } from "@/app/features/messaging/services/chat-state-store";

/**
 * Ensures debounced chat-state writes (groups, conversations) land in localStorage
 * before mobile WebView refresh or tab close.
 */
export function ChatStateDurabilityOwner(): null {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const flushPendingChatState = (): void => {
      chatStateStoreService.flushAllPending();
    };
    window.addEventListener("pagehide", flushPendingChatState);
    window.addEventListener("beforeunload", flushPendingChatState);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushPendingChatState();
      }
    });
    return () => {
      window.removeEventListener("pagehide", flushPendingChatState);
      window.removeEventListener("beforeunload", flushPendingChatState);
    };
  }, []);

  return null;
}
