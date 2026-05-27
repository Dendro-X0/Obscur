"use client";

import type React from "react";
import dynamic from "next/dynamic";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useGroups } from "@/app/features/groups/providers/group-provider";

const GlobalDialogManager = dynamic(
  () =>
    import("./global-dialog-manager").then((module) => ({
      default: module.GlobalDialogManager,
    })),
  { ssr: false },
);

/**
 * Defers GlobalDialogManager (and useEnhancedDmController) until create-chat or
 * create-group is opened. Dialog open flags live in MessagingProvider / GroupProvider.
 */
export function LazyGlobalDialogManager(): React.JSX.Element | null {
  const { isNewChatOpen } = useMessaging();
  const { isNewGroupOpen } = useGroups();

  if (!isNewChatOpen && !isNewGroupOpen) {
    return null;
  }

  return <GlobalDialogManager />;
}
