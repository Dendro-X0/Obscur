import { describe, expect, it } from "vitest";
import { resolveVoiceOfferDispatchFailureUi } from "./voice-offer-dispatch-honesty";

describe("voice-offer-dispatch-honesty", () => {
  it("PB1-C: maps host offer dispatch failure to interrupted network honesty", () => {
    expect(resolveVoiceOfferDispatchFailureUi()).toEqual({
      phase: "interrupted",
      reasonCode: "network_interrupted",
      toastKey: "messaging.voiceCallOfferSendFailed",
      logStatus: "offer_dispatch_failed",
    });
  });
});
