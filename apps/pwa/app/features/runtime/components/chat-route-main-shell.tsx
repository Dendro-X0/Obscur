"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import MainShell from "@/app/features/main-shell/main-shell";
import { GlobalVoiceCallOverlay } from "@/app/features/messaging/components/global-voice-call-overlay";

const isChatRoutePath = (pathname: string | null): boolean => pathname === "/";

/**
 * Chat shell mounts only on `/`. DM list/thread state lives in MessagingProvider + dm-kernel
 * SQLite; unmounting MainShell off-route subtracts thousands of hook subscriptions during
 * sidebar navigation (P2). useConversationMessages re-hydrates when returning to `/`.
 */
export function ChatRouteMainShell(): React.JSX.Element | null {
  const pathname = usePathname();
  if (!isChatRoutePath(pathname)) {
    return null;
  }
  return (
    <div
      data-chat-route-active="true"
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <MainShell />
    </div>
  );
}

export function ChatRouteVoiceCallOverlay(): React.JSX.Element | null {
  const pathname = usePathname();
  if (!isChatRoutePath(pathname)) {
    return null;
  }
  return <GlobalVoiceCallOverlay />;
}
