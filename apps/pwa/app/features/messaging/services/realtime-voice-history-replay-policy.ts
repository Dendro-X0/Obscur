export type BootstrappedVoiceSignalReplayDecisionReason =
  | "active_session_match"
  | "pending_invite_match"
  | "ui_status_match"
  | "historical_restore_static";

export type BootstrappedVoiceInviteReplayDecisionReason =
  | "ui_status_match"
  | "historical_restore_static";

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
}>): Readonly<{
  shouldReplay: boolean;
  reasonCode: BootstrappedVoiceInviteReplayDecisionReason;
}> => {
  if (params.statusMatches) {
    return { shouldReplay: true, reasonCode: "ui_status_match" };
  }
  return { shouldReplay: false, reasonCode: "historical_restore_static" };
};
