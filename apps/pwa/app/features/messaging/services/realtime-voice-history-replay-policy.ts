/**
 * MED-002 — quarantine historical voice rows during the first post-sync bootstrap pass.
 *
 * Restored DM timelines can contain voice-call-signal / voice-call-invite payloads that
 * must not re-enter live WebRTC handling. Only resume when an in-flight session or UI
 * status already matches the row; otherwise ignore until a later live message arrives.
 */

export type VoiceHistoryReplayDecision = Readonly<{
  shouldReplay: boolean;
  reasonCode:
    | "accept"
    | "status_matches"
    | "signal_too_old"
    | "invite_too_old"
    | "bootstrap_history_quarantined"
    | "resume_active_session";
}>;

export const resolveVoiceSignalBootstrapReplayDecision = (params: Readonly<{
  isBootstrapPass: boolean;
  signalAgeMs: number;
  maxSignalAgeMs: number;
  activeSessionMatches: boolean;
  pendingInviteMatches: boolean;
  statusMatches: boolean;
}>): VoiceHistoryReplayDecision => {
  if (params.activeSessionMatches || params.pendingInviteMatches) {
    return { shouldReplay: true, reasonCode: "resume_active_session" };
  }
  if (params.statusMatches) {
    return { shouldReplay: false, reasonCode: "status_matches" };
  }
  if (params.signalAgeMs > params.maxSignalAgeMs) {
    return { shouldReplay: false, reasonCode: "signal_too_old" };
  }
  if (params.isBootstrapPass) {
    return { shouldReplay: false, reasonCode: "bootstrap_history_quarantined" };
  }
  return { shouldReplay: true, reasonCode: "accept" };
};

export const resolveVoiceInviteBootstrapReplayDecision = (params: Readonly<{
  isBootstrapPass: boolean;
  inviteAgeMs: number;
  maxInviteAgeMs: number;
  statusMatches: boolean;
}>): VoiceHistoryReplayDecision => {
  if (params.statusMatches) {
    return { shouldReplay: false, reasonCode: "status_matches" };
  }
  if (params.inviteAgeMs > params.maxInviteAgeMs) {
    return { shouldReplay: false, reasonCode: "invite_too_old" };
  }
  if (params.isBootstrapPass) {
    return { shouldReplay: false, reasonCode: "bootstrap_history_quarantined" };
  }
  return { shouldReplay: true, reasonCode: "accept" };
};
