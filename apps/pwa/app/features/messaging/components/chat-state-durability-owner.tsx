"use client";

import { useEffect } from "react";
import { messagingChatStateDurabilityPort } from "../services/messaging-chat-state-durability-port";

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
      messagingChatStateDurabilityPort.flushAllPending();
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
