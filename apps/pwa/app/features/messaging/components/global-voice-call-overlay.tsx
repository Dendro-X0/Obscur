"use client";

import React, { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { VoiceCallDock } from "./voice-call-dock";
import { IncomingVoiceCallToast } from "./incoming-voice-call-toast";
import { useGlobalVoiceCallOverlayState } from "../services/realtime-voice-global-ui-store";
import {
  dispatchVoiceCallOverlayAction,
  type VoiceCallOverlayAction,
} from "../services/voice-call-overlay-action-bridge";
import { isMobileShellProduct } from "@/app/features/runtime/shell-contract";
import { resolveVoiceCallPresentation } from "../services/realtime-call-presentation";

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

export function GlobalVoiceCallOverlay(): React.JSX.Element | null {
  const pathname = usePathname();
  const router = useRouter();
  const overlay = useGlobalVoiceCallOverlayState();
  const isChatRoute = pathname === "/";
  const anchorMode = isChatRoute ? "chat" : "page";

  const relayActionToChatSurface = useCallback((action: VoiceCallOverlayAction): void => {
    dispatchVoiceCallOverlayAction(action);
    if (
      !isChatRoute
      && (action === "open_chat" || action === "accept" || action === "decline")
    ) {
      router.push("/");
    }
  }, [isChatRoute, router]);

  if (!overlay.status) {
    return null;
  }

  const overlayNode = overlay.status.phase === "ringing_incoming"
    ? (
      <IncomingVoiceCallToast
        isOpen
        inviterDisplayName={overlay.peerDisplayName}
        inviterAvatarUrl={overlay.peerAvatarUrl}
        roomIdHint={toRoomIdHint(overlay.status.roomId)}
        anchorMode={anchorMode}
        onAccept={() => relayActionToChatSurface("accept")}
        onDecline={() => relayActionToChatSurface("decline")}
        onDismiss={() => relayActionToChatSurface("dismiss")}
      />
    )
    : (
      <VoiceCallDock
        status={overlay.status}
        peerDisplayName={overlay.peerDisplayName}
        peerAvatarUrl={overlay.peerAvatarUrl}
        anchorMode={anchorMode}
        audioLevel={overlay.waveAudioLevel}
        localVideoStream={overlay.localVideoStream}
        remoteVideoStream={overlay.remoteVideoStream}
        onOpenChat={() => relayActionToChatSurface("open_chat")}
        onAccept={() => relayActionToChatSurface("accept")}
        onDecline={() => relayActionToChatSurface("decline")}
        onEnd={() => relayActionToChatSurface("end")}
        onDismiss={() => relayActionToChatSurface("dismiss")}
        presentation={resolveVoiceCallPresentation({
          isMobileShell: isMobileShellProduct(),
          callType: overlay.status.callType,
          phase: overlay.status.phase,
        })}
      />
    );

  if (typeof document === "undefined") {
    return overlayNode;
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[2147482990]">
      {overlayNode}
    </div>,
    document.body,
  );
}
