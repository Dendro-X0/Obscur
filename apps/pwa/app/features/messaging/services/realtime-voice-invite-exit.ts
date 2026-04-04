export type IncomingVoiceInviteExitKind = "decline" | "dismiss";

type PendingIncomingVoiceInviteLike = Readonly<{
  peerPubkey: string;
  invite: Readonly<{
    roomId?: string;
  }>;
}>;

type VoiceCallUiStatusLike = Readonly<{
  roomId: string;
  peerPubkey: string;
  phase: "ringing_outgoing" | "ringing_incoming" | "connecting" | "connected" | "interrupted" | "ended";
  role: "host" | "joiner";
  sinceUnixMs: number;
  reasonCode?: "left_by_user" | "remote_left" | "network_interrupted" | "session_closed";
}>;

type VoiceLeaveSignalTarget = Readonly<{
  roomId: string;
  peerPubkey: string;
}>;

export type IncomingVoiceInviteExitResolution = Readonly<{
  nextStatus: VoiceCallUiStatusLike | null;
  leaveSignalTarget: VoiceLeaveSignalTarget | null;
}>;

export const resolveIncomingVoiceInviteExit = (params: Readonly<{
  pendingIncomingInvite: PendingIncomingVoiceInviteLike | null;
  kind: IncomingVoiceInviteExitKind;
  canDispatchLeaveSignal: boolean;
  nowUnixMs?: number;
}>): IncomingVoiceInviteExitResolution => {
  const pending = params.pendingIncomingInvite;
  if (!pending) {
    return {
      nextStatus: null,
      leaveSignalTarget: null,
    };
  }

  const roomId = pending.invite.roomId?.trim() ?? "";
  const peerPubkey = pending.peerPubkey.trim();
  if (!roomId || !peerPubkey) {
    return {
      nextStatus: null,
      leaveSignalTarget: null,
    };
  }

  const nowUnixMs = typeof params.nowUnixMs === "number" && Number.isFinite(params.nowUnixMs)
    ? Math.floor(params.nowUnixMs)
    : Date.now();
  const nextStatus: VoiceCallUiStatusLike = params.kind === "decline"
    ? {
      roomId,
      peerPubkey,
      phase: "ended",
      role: "joiner",
      sinceUnixMs: nowUnixMs,
      reasonCode: "left_by_user",
    }
    : {
      roomId,
      peerPubkey,
      phase: "interrupted",
      role: "joiner",
      sinceUnixMs: nowUnixMs,
      reasonCode: "session_closed",
    };

  return {
    nextStatus,
    leaveSignalTarget: params.canDispatchLeaveSignal
      ? {
        roomId,
        peerPubkey,
      }
      : null,
  };
};
