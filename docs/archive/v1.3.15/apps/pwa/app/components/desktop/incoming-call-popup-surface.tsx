"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { IncomingVoiceCallToast } from "@/app/features/messaging/components/incoming-voice-call-toast";
import { getTauriAPI, isDesktopEnvironment } from "@/app/features/desktop/utils/tauri-api";
import {
  INCOMING_CALL_POPUP_WINDOW_LABEL,
  getCurrentDesktopWindowLabel,
} from "@/app/features/desktop/utils/window-labels";
import { listenToNativeEvent } from "@/app/features/runtime/native-event-adapter";

type IncomingCallPopupPayload = Readonly<{
  active: boolean;
  callerName: string;
  roomId: string;
}>;

const EMPTY_POPUP_STATE: IncomingCallPopupPayload = {
  active: false,
  callerName: "",
  roomId: "",
};

const INCOMING_CALL_STATE_EVENT_NAME = "desktop://incoming-call-state";

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

const normalizePopupPayload = (payload: unknown): IncomingCallPopupPayload => {
  if (!payload || typeof payload !== "object") {
    return EMPTY_POPUP_STATE;
  }
  const typed = payload as Partial<IncomingCallPopupPayload>;
  return {
    active: typed.active === true,
    callerName: typeof typed.callerName === "string" ? typed.callerName : "",
    roomId: typeof typed.roomId === "string" ? typed.roomId : "",
  };
};

export function IncomingCallPopupSurface(): React.JSX.Element | null {
  const isPopupWindow = useMemo(() => (
    isDesktopEnvironment() && getCurrentDesktopWindowLabel() === INCOMING_CALL_POPUP_WINDOW_LABEL
  ), []);
  const [state, setState] = useState<IncomingCallPopupPayload>(EMPTY_POPUP_STATE);

  useEffect(() => {
    if (!isPopupWindow) {
      return;
    }
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void (async () => {
      const snapshot = await getTauriAPI().incomingCall.getState();
      if (!disposed) {
        setState(snapshot);
      }
      unlisten = await listenToNativeEvent<IncomingCallPopupPayload>(
        INCOMING_CALL_STATE_EVENT_NAME,
        (event) => {
          if (disposed) {
            return;
          }
          setState(normalizePopupPayload(event.payload));
        }
      );
    })();
    return () => {
      disposed = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, [isPopupWindow]);

  const performAction = useCallback(async (action: "accept" | "decline" | "dismiss"): Promise<void> => {
    await getTauriAPI().incomingCall.performAction(action);
  }, []);

  if (!isPopupWindow) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[2147483640] bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.15),transparent_38%),radial-gradient(circle_at_left,rgba(99,102,241,0.16),transparent_42%),rgba(5,8,20,0.85)]">
      <IncomingVoiceCallToast
        isOpen={state.active}
        inviterDisplayName={state.callerName.trim() || "Unknown caller"}
        inviterAvatarUrl=""
        roomIdHint={toRoomIdHint(state.roomId)}
        onAccept={() => {
          void performAction("accept");
        }}
        onDecline={() => {
          void performAction("decline");
        }}
        onDismiss={() => {
          void performAction("dismiss");
        }}
      />
    </div>
  );
}
