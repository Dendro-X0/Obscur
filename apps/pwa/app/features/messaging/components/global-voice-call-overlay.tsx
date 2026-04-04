"use client";

import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { VoiceCallDock } from "./voice-call-dock";
import { IncomingVoiceCallToast } from "./incoming-voice-call-toast";
import { useGlobalVoiceCallOverlayState } from "../services/realtime-voice-global-ui-store";

const OVERLAY_ACTION_STORAGE_KEY = "obscur.voice_call.overlay_action.v1";
const OVERLAY_ACTION_EVENT_NAME = "obscur:voice-call-overlay-action";

type OverlayAction = "open_chat" | "accept" | "decline" | "end" | "dismiss";

const toRoomIdHint = (roomIdInput: string): string => {
  const roomId = roomIdInput.trim();
  if (!roomId) {
    return "unknown-room";
  }
  if (roomId.length <= 24) {
    return roomId;
  }
  return `${roomId.slice(0, 10)}...${roomId.slice(-10)}`;
};

const dispatchOverlayAction = (action: OverlayAction): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(
      OVERLAY_ACTION_STORAGE_KEY,
      JSON.stringify({
        action,
        atUnixMs: Date.now(),
      }),
    );
  } catch {
    // best effort bridge only
  }
  window.dispatchEvent(new CustomEvent(OVERLAY_ACTION_EVENT_NAME, {
    detail: { action },
  }));
};

export function GlobalVoiceCallOverlay(): React.JSX.Element | null {
  const pathname = usePathname();
  const router = useRouter();
  const overlay = useGlobalVoiceCallOverlayState();
  const isChatRoute = pathname === "/";

  const relayActionToChatSurface = useCallback((action: OverlayAction): void => {
    dispatchOverlayAction(action);
    if (action === "open_chat" && !isChatRoute) {
      router.push("/");
    }
  }, [isChatRoute, router]);

  if (!overlay.status || isChatRoute) {
    return null;
  }

  if (overlay.status.phase === "ringing_incoming") {
    return (
      <IncomingVoiceCallToast
        isOpen
        inviterDisplayName={overlay.peerDisplayName}
        inviterAvatarUrl={overlay.peerAvatarUrl}
        roomIdHint={toRoomIdHint(overlay.status.roomId)}
        onAccept={() => relayActionToChatSurface("accept")}
        onDecline={() => relayActionToChatSurface("decline")}
        onDismiss={() => relayActionToChatSurface("dismiss")}
      />
    );
  }

  return (
    <VoiceCallDock
      status={overlay.status}
      peerDisplayName={overlay.peerDisplayName}
      peerAvatarUrl={overlay.peerAvatarUrl}
      onOpenChat={() => relayActionToChatSurface("open_chat")}
      onAccept={() => relayActionToChatSurface("accept")}
      onDecline={() => relayActionToChatSurface("decline")}
      onEnd={() => relayActionToChatSurface("end")}
      onDismiss={() => relayActionToChatSurface("dismiss")}
    />
  );
}
