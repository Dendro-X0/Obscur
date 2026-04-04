type VoiceCallPhase = "ringing_outgoing" | "ringing_incoming" | "connecting" | "connected" | "interrupted" | "ended";

type VoiceCallStatusLike = Readonly<{
  roomId: string;
  peerPubkey: string;
  phase: VoiceCallPhase;
}>;

type PendingIncomingVoiceInviteLike = Readonly<{
  peerPubkey: string;
  invite: Readonly<{
    roomId?: string;
  }>;
}>;

export const shouldSuppressVoiceCallDockForPendingIncomingInvite = (params: Readonly<{
  status: VoiceCallStatusLike | null;
  pendingIncomingInvite: PendingIncomingVoiceInviteLike | null;
}>): boolean => {
  if (!params.status || !params.pendingIncomingInvite) {
    return false;
  }
  if (params.status.phase !== "ringing_incoming") {
    return false;
  }
  const statusRoomId = params.status.roomId.trim();
  const inviteRoomId = params.pendingIncomingInvite.invite.roomId?.trim() ?? "";
  if (!statusRoomId || !inviteRoomId || statusRoomId !== inviteRoomId) {
    return false;
  }
  return params.status.peerPubkey.trim() === params.pendingIncomingInvite.peerPubkey.trim();
};
