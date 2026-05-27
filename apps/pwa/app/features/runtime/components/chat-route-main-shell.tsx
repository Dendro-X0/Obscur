"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import MainShell from "@/app/features/main-shell/main-shell";
import { GlobalVoiceCallOverlay } from "@/app/features/messaging/components/global-voice-call-overlay";

const isChatRoutePath = (pathname: string | null): boolean => pathname === "/";

/**
 * Chat shell stays mounted across sidebar routes so DM thread state (useConversationMessages)
 * is not torn down when visiting /settings, /network, etc. Hidden off-route to avoid layout bleed.
 */
export function ChatRouteMainShell(): React.JSX.Element {
  const pathname = usePathname();
  const onChatRoute = isChatRoutePath(pathname);
  return (
    <div
      hidden={!onChatRoute}
      data-chat-route-active={onChatRoute ? "true" : "false"}
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
