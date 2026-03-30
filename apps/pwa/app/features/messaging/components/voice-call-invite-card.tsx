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
  const hasConnected = (callSummary?.connectedAtUnixMs ?? null) !== null;
  const resolvedNowUnixMs = typeof nowUnixMs === "number" && Number.isFinite(nowUnixMs)
    ? nowUnixMs
    : null;
  const inviteExpiredByNow = typeof invite.expiresAtUnixMs === "number"
    && resolvedNowUnixMs !== null
    && invite.expiresAtUnixMs <= resolvedNowUnixMs;
  const endedWithoutConnection = (callSummary?.endedAtUnixMs ?? null) !== null && !hasConnected;
  const unconnectedRejected = !callSummary?.endedNormally && !hasConnected && liveStatusPhase === "interrupted";
  const unconnectedTimeout = !callSummary?.endedNormally && !unconnectedRejected && !hasConnected && (
    inviteExpiredByNow || endedWithoutConnection || liveStatusPhase === "ended"
  );
  const cardState = callSummary?.endedNormally
    ? "ended_normal"
    : unconnectedRejected
      ? "unconnected_rejected"
      : unconnectedTimeout
        ? "unconnected_timeout"
        : "active";
  const showCallbackAction = cardState === "unconnected_timeout" && typeof onRequestCallback === "function" && !callbackConsumed;
  const showJoinAction = canJoin && !callSummary?.endedNormally && cardState === "active" && !hasTerminalLivePhase;
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
  const stateSubtitle = (() => {
    switch (cardState) {
      case "ended_normal":
        return t("messaging.voiceCallEndedNormally", "Ended normally");
      case "unconnected_timeout":
        return t("messaging.voiceCallTimedOutBeforeConnect", "Timed out before connection");
      case "unconnected_rejected":
        return t("messaging.voiceCallDeclinedBeforeConnect", "Declined before connection");
      default:
        return isOutgoing
          ? t("messaging.voiceCallInviteSent", "Invitation sent")
          : t("messaging.voiceCallInviteReceived", "Incoming invitation");
    }
  })();
  const statusBadgeLabel = (() => {
    switch (cardState) {
      case "ended_normal":
        return t("messaging.voiceCallCompleted", "Call completed");
      case "unconnected_timeout":
        return t("messaging.voiceCallNoAnswer", "No answer (timed out)");
      case "unconnected_rejected":
        return t("messaging.voiceCallDeclined", "Call declined");
      default:
        return liveStatusLabel;
    }
  })();
  const containerToneClass = (() => {
    switch (cardState) {
      case "ended_normal":
        return "ring-1 ring-emerald-500/35";
      case "unconnected_timeout":
        return "ring-1 ring-amber-500/35";
      case "unconnected_rejected":
        return "ring-1 ring-rose-500/40";
      default:
        return isOutgoing
          ? "ring-1 ring-purple-500/30"
          : "ring-1 ring-sky-500/25";
    }
  })();
  const accentScrimClass = (() => {
    switch (cardState) {
      case "ended_normal":
        return "from-emerald-500/24 to-transparent dark:from-emerald-400/28";
      case "unconnected_timeout":
        return "from-amber-500/24 to-transparent dark:from-amber-400/30";
      case "unconnected_rejected":
        return "from-rose-500/24 to-transparent dark:from-rose-400/30";
      default:
        return isOutgoing
          ? "from-purple-500/18 to-transparent dark:from-purple-400/24"
          : "from-sky-500/16 to-transparent dark:from-sky-400/24";
    }
  })();
  const iconToneClass = (() => {
    switch (cardState) {
      case "ended_normal":
        return "bg-emerald-500/18 text-emerald-700 dark:bg-emerald-400/22 dark:text-emerald-200";
      case "unconnected_timeout":
        return "bg-amber-500/18 text-amber-700 dark:bg-amber-400/24 dark:text-amber-200";
      case "unconnected_rejected":
        return "bg-rose-500/18 text-rose-700 dark:bg-rose-400/24 dark:text-rose-200";
      default:
        return isOutgoing
          ? "bg-purple-500/18 text-purple-700 dark:bg-purple-400/22 dark:text-purple-200"
          : "bg-sky-500/15 text-sky-700 dark:bg-sky-400/22 dark:text-sky-200";
    }
  })();
  const titleToneClass = (() => {
    switch (cardState) {
      case "ended_normal":
        return "text-emerald-700 dark:text-emerald-300";
      case "unconnected_timeout":
        return "text-amber-700 dark:text-amber-300";
      case "unconnected_rejected":
        return "text-rose-700 dark:text-rose-300";
      default:
        return isOutgoing ? "text-purple-700 dark:text-purple-300" : "text-sky-700 dark:text-sky-300";
    }
  })();
  const badgeToneClass = (() => {
    switch (cardState) {
      case "ended_normal":
        return "border-emerald-500/35 bg-emerald-500/15 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200";
      case "unconnected_timeout":
        return "border-amber-500/35 bg-amber-500/15 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200";
      case "unconnected_rejected":
        return "border-rose-500/40 bg-rose-500/15 text-rose-800 dark:bg-rose-400/22 dark:text-rose-200";
      default:
        return "border-sky-500/35 bg-sky-500/14 text-sky-800 dark:bg-sky-400/20 dark:text-sky-200";
    }
  })();

  return (
    <div
      data-testid="voice-call-invite-card"
      className={cn(
        "relative max-w-[420px] overflow-hidden rounded-2xl border border-surface-contrast px-3.5 py-2.5 text-surface-contrast-primary",
        "bg-gradient-surface-contrast shadow-[0_12px_30px_rgba(15,23,42,0.14)] dark:shadow-[0_14px_36px_rgba(0,0,0,0.46)]",
        containerToneClass
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b",
          accentScrimClass
        )}
      />
      <div className="relative flex items-center gap-2.5">
        <div
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full",
            iconToneClass
          )}
        >
          <PhoneCall className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <div className={cn("text-[11px] font-black uppercase tracking-[0.14em]", titleToneClass)}>
            {t("messaging.voiceCallInvite", "Voice Call Invite")}
          </div>
          <div className="text-[12px] font-semibold leading-4 text-surface-contrast-secondary">
            {stateSubtitle}
          </div>
        </div>
      </div>

      <div className="relative mt-2.5 grid grid-cols-[62px,1fr] items-center gap-x-2 gap-y-1 text-[12px] leading-4.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-surface-contrast-secondary">
            {t("messaging.voiceCallRoom", "Room")}
        </span>
        <span className="inline-flex min-w-0 items-center rounded-md border border-surface-contrast bg-black/5 px-2 py-0.5 font-mono text-[11px] text-surface-contrast-primary dark:bg-white/5">
          <span className="truncate">{roomIdHint}</span>
        </span>
        {invitedAtLabel ? (
          <>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-surface-contrast-secondary">
              <Clock3 className="h-3 w-3" />
              {t("messaging.voiceCallInvitedAt", "Invited")}
            </span>
            <span className="truncate tabular-nums text-[12px] text-surface-contrast-primary">
              {invitedAtLabel}
            </span>
          </>
        ) : null}
        {expiresAtLabel ? (
          <>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-surface-contrast-secondary">
              {t("messaging.voiceCallExpiresAt", "Expires")}
            </span>
            <span className="truncate tabular-nums text-[12px] text-surface-contrast-primary">
              {expiresAtLabel}
            </span>
          </>
        ) : null}
        {callSummary?.endedNormally ? (
          <>
            {endedAtLabel ? (
              <>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-surface-contrast-secondary">
                  {t("messaging.voiceCallEndedAt", "Ended")}
                </span>
                <span className="truncate tabular-nums text-[12px] text-surface-contrast-primary">
                  {endedAtLabel}
                </span>
              </>
            ) : null}
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-surface-contrast-secondary">
                {t("messaging.voiceCallDuration", "Duration")}
            </span>
            <span className="tabular-nums text-[13px] font-bold text-surface-contrast-primary">
              {durationLabel ?? "0:00"}
            </span>
          </>
        ) : null}
      </div>
      <div className="relative mt-2.5 flex justify-end">
        {statusBadgeLabel ? (
          <span
            data-testid="voice-call-status-badge"
            className={cn(
              "mr-auto inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest",
              badgeToneClass
            )}
          >
            {statusBadgeLabel}
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
        {cardState === "unconnected_timeout" && callbackConsumed ? (
          <span className="inline-flex items-center rounded-full border border-surface-contrast bg-black/5 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-surface-contrast-secondary dark:bg-white/5">
            {t("messaging.voiceCallCallbackUsed", "Callback used")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
