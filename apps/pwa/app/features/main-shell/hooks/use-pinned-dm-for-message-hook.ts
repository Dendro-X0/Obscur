"use client";

import { useRef } from "react";
import type { Conversation, DmConversation } from "../../messaging/types";

/**
 * Radical ownership split: DM message hydration stays on the last opened DM thread
 * while the user views a group. Group selection must not re-bind or suspend the hook.
 */
export const usePinnedDmForMessageHook = (
  selectedConversation: Conversation | null | undefined,
): DmConversation | null => {
  const lastDmRef = useRef<DmConversation | null>(null);

  if (selectedConversation?.kind === "dm") {
    lastDmRef.current = selectedConversation;
    return selectedConversation;
  }

  return lastDmRef.current;
};
