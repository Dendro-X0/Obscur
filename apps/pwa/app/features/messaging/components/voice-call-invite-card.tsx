"use client";

import React from "react";
import { PhoneCall, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../../lib/cn";
import { Button } from "../../../components/ui/button";
import type { VoiceCallInvitePayload } from "../types";
import type { VoiceCallRoomRenderSummary } from "./message-list-render-meta";

type VoiceCallInviteCardProps = Readonly<{
  invite: VoiceCallInvitePayload;
  isOutgoing: boolean;
  isJoining?: boolean;
  onJoinCall?: (invite: VoiceCallInvitePayload) => void;
  onRequestCallback?: () => void;
  callbackConsumed?: boolean;
  callSummary?: VoiceCallRoomRenderSummary | null;
  nowUnixMs?: number | null;
  liveStatusPhase?: "ringing_outgoing" | "ringing_incoming" | "connecting" | "connected" | "interrupted" | "ended" | null;
}>;

const toRoomIdHint = (roomIdInput: unknown): string => {
  if (typeof roomIdInput !== "string") {
    return "unknown-room";
  }
  const roomId = roomIdInput.trim();
  if (!roomId) {
    return "unknown-room";
  }
  if (roomId.length <= 24) {
    return roomId;
  }
  return `${roomId.slice(0, 10)}...${roomId.slice(-10)}`;
};

const toTimestampLabel = (value: unknown): string | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return null;
  }
  return timestamp.toLocaleString();
};

const toDurationLabel = (value: unknown): string | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export function VoiceCallInviteCard({
  invite,
  isOutgoing,
  isJoining = false,
  onJoinCall,
  onRequestCallback,
  callbackConsumed = false,
  callSummary = null,
  nowUnixMs = null,
  liveStatusPhase = null,
}: VoiceCallInviteCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const roomIdHint = toRoomIdHint(invite.roomId);
  const invitedAtLabel = toTimestampLabel(invite.invitedAtUnixMs);
  const expiresAtLabel = toTimestampLabel(invite.expiresAtUnixMs);
  const canJoin = !isOutgoing && typeof onJoinCall === "function";
  const hasTerminalLivePhase = liveStatusPhase === "interrupted" || liveStatusPhase === "ended";
  const endedAtLabel = toTimestampLabel(callSummary?.endedAtUnixMs ?? null);
  const durationLabel = toDurationLabel(callSummary?.durationSeconds ?? null);
  const resolvedNowUnixMs = typeof nowUnixMs === "number" && Number.isFinite(nowUnixMs)
    ? nowUnixMs
    : null;
  const timedOutUnconnected = !callSummary?.endedNormally && (
    (typeof invite.expiresAtUnixMs === "number" && resolvedNowUnixMs !== null && invite.expiresAtUnixMs <= resolvedNowUnixMs)
    || ((callSummary?.endedAtUnixMs ?? null) !== null && (callSummary?.connectedAtUnixMs ?? null) === null)
    || (hasTerminalLivePhase && (callSummary?.connectedAtUnixMs ?? null) === null)
  );
  const showCallbackAction = timedOutUnconnected && typeof onRequestCallback === "function" && !callbackConsumed;
  const showJoinAction = canJoin && !callSummary?.endedNormally && !timedOutUnconnected && !hasTerminalLivePhase;
  const liveStatusLabel = (() => {
    switch (liveStatusPhase) {
      case "ringing_outgoing":
        return t("messaging.voiceCallRingingOutgoing", "Calling...");
      case "ringing_incoming":
        return t("messaging.voiceCallRingingIncoming", "Incoming call");
      case "connecting":
        return t("messaging.voiceCallConnecting", "Connecting...");
      case "connected":
        return t("messaging.voiceCallConnected", "In call");
      case "interrupted":
        return t("messaging.voiceCallInterrupted", "Call interrupted");
      case "ended":
        return t("messaging.voiceCallEnded", "Call ended");
      default:
        return null;
    }
  })();

  return (
    <div
      className={cn(
        "max-w-[320px] rounded-2xl border p-3 shadow-sm",
        isOutgoing
          ? "border-white/15 bg-white/10 text-white dark:border-zinc-300/40 dark:bg-zinc-100/90 dark:text-zinc-900"
          : "border-black/10 bg-white/80 text-zinc-900 dark:border-white/10 dark:bg-zinc-900/70 dark:text-zinc-100"
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full",
            isOutgoing ? "bg-white/20 dark:bg-zinc-800/60" : "bg-zinc-200 dark:bg-zinc-800"
          )}
        >
          <PhoneCall className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-widest opacity-80">
            {t("messaging.voiceCallInvite", "Voice Call Invite")}
          </div>
          <div className="text-xs font-medium opacity-90">
            {isOutgoing
              ? t("messaging.voiceCallInviteSent", "Invitation sent")
              : t("messaging.voiceCallInviteReceived", "Incoming invitation")}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-[11px]">
        <div className="font-mono opacity-90">
          {t("messaging.voiceCallRoom", "Room")}: {roomIdHint}
        </div>
        {invitedAtLabel ? (
          <div className="inline-flex items-center gap-1 opacity-75">
            <Clock3 className="h-3 w-3" />
            {t("messaging.voiceCallInvitedAt", "Invited")}: {invitedAtLabel}
          </div>
        ) : null}
        {expiresAtLabel ? (
          <div className="opacity-70">
            {t("messaging.voiceCallExpiresAt", "Expires")}: {expiresAtLabel}
          </div>
        ) : null}
        {callSummary?.endedNormally ? (
          <>
            {endedAtLabel ? (
              <div className="opacity-75">
                {t("messaging.voiceCallEndedAt", "Ended")}: {endedAtLabel}
              </div>
            ) : null}
            <div className="opacity-75">
              {t("messaging.voiceCallDuration", "Duration")}: {durationLabel ?? "0:00"}
            </div>
          </>
        ) : null}
      </div>
      <div className="mt-3 flex justify-end">
        {liveStatusLabel ? (
          <span className="mr-auto inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
            {liveStatusLabel}
          </span>
        ) : null}
        {showJoinAction ? (
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-lg px-3 text-[11px] font-bold"
            onClick={() => onJoinCall?.(invite)}
            disabled={isJoining}
          >
            {isJoining
              ? t("messaging.voiceCallJoining", "Joining...")
              : t("messaging.voiceCallJoin", "Join Call")}
          </Button>
        ) : null}
        {showCallbackAction ? (
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-lg px-3 text-[11px] font-bold"
            onClick={onRequestCallback}
          >
            {t("messaging.voiceCallCallback", "Call Back")}
          </Button>
        ) : null}
        {timedOutUnconnected && callbackConsumed ? (
          <span className="inline-flex items-center rounded-full border border-zinc-400/40 px-2 py-1 text-[10px] font-black uppercase tracking-widest opacity-80">
            {t("messaging.voiceCallCallbackUsed", "Callback used")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
