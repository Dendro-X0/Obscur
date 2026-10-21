import { describe, expect, it } from "vitest";
import { resolveVoiceAnswerDispatchFailureUi } from "./voice-answer-dispatch-honesty";

describe("voice-answer-dispatch-honesty", () => {
  it("PB1-C: maps joiner answer failure to interrupted network honesty", () => {
    expect(resolveVoiceAnswerDispatchFailureUi()).toEqual({
      phase: "interrupted",
      reasonCode: "network_interrupted",
      toastKey: "messaging.voiceCallAnswerSendFailed",
      logStatus: "answer_dispatch_failed",
    });
  });
});
