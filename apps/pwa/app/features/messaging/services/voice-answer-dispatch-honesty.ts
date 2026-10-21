/**
 * PB1-C: joiner answer create/send (or setRemote on offer) failure must interrupt the dock.
 */

export type VoiceAnswerDispatchFailureUi = Readonly<{
  phase: "interrupted";
  reasonCode: "network_interrupted";
  toastKey: "messaging.voiceCallAnswerSendFailed";
  logStatus: "answer_dispatch_failed";
}>;

export const resolveVoiceAnswerDispatchFailureUi = (): VoiceAnswerDispatchFailureUi => ({
  phase: "interrupted",
  reasonCode: "network_interrupted",
  toastKey: "messaging.voiceCallAnswerSendFailed",
  logStatus: "answer_dispatch_failed",
});
