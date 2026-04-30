// Maximum age for voice call invites to be considered "active" during bootstrap/sync
// Invites older than this are considered historical and ignored to prevent ghost calls
const VOICE_CALL_INVITE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

export type BootstrappedVoiceSignalReplayDecisionReason =
  | "active_session_match"
  | "pending_invite_match"
  | "ui_status_match"
  | "historical_restore_static";

export type BootstrappedVoiceInviteReplayDecisionReason =
  | "ui_status_match"
  | "historical_restore_static"
  | "invite_expired"
  | "invite_too_old"; // New reason for ghost call prevention

export const resolveBootstrappedVoiceSignalReplayDecision = (params: Readonly<{
  activeSessionMatches: boolean;
  pendingInviteMatches: boolean;
  statusMatches: boolean;
}>): Readonly<{
  shouldReplay: boolean;
  reasonCode: BootstrappedVoiceSignalReplayDecisionReason;
}> => {
  if (params.activeSessionMatches) {
    return { shouldReplay: true, reasonCode: "active_session_match" };
  }
  if (params.pendingInviteMatches) {
    return { shouldReplay: true, reasonCode: "pending_invite_match" };
  }
  if (params.statusMatches) {
    return { shouldReplay: true, reasonCode: "ui_status_match" };
  }
  return { shouldReplay: false, reasonCode: "historical_restore_static" };
};

export const resolveBootstrappedVoiceInviteReplayDecision = (params: Readonly<{
  statusMatches: boolean;
  invitedAtUnixMs?: number;
  expiresAtUnixMs?: number;
  nowUnixMs: number;
}>): Readonly<{
  shouldReplay: boolean;
  reasonCode: BootstrappedVoiceInviteReplayDecisionReason;
}> => {
  // If invite has explicit expiration, check it first
  if (typeof params.expiresAtUnixMs === "number" && params.expiresAtUnixMs < params.nowUnixMs) {
    return { shouldReplay: false, reasonCode: "invite_expired" };
  }

  // GHOST CALL PREVENTION: Check if invite is too old
  // During account sync, historical invites from days/weeks ago should not trigger calls
  if (typeof params.invitedAtUnixMs === "number") {
    const inviteAgeMs = params.nowUnixMs - params.invitedAtUnixMs;
    if (inviteAgeMs > VOICE_CALL_INVITE_MAX_AGE_MS) {
      return { shouldReplay: false, reasonCode: "invite_too_old" };
    }
  }

  if (params.statusMatches) {
    return { shouldReplay: true, reasonCode: "ui_status_match" };
  }
  return { shouldReplay: false, reasonCode: "historical_restore_static" };
};
