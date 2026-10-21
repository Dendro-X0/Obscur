/**
 * PB1-C: host offer create/send failure must interrupt the dock with a toast.
 */

export type VoiceOfferDispatchFailureUi = Readonly<{
  phase: "interrupted";
  reasonCode: "network_interrupted";
  toastKey: "messaging.voiceCallOfferSendFailed";
  logStatus: "offer_dispatch_failed";
}>;

export const resolveVoiceOfferDispatchFailureUi = (): VoiceOfferDispatchFailureUi => ({
  phase: "interrupted",
  reasonCode: "network_interrupted",
  toastKey: "messaging.voiceCallOfferSendFailed",
  logStatus: "offer_dispatch_failed",
});
