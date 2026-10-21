import { describe, expect, it } from "vitest";
import { resolveVoicePeerConnectionStartFailureUi } from "./voice-peer-connection-start-honesty";

describe("voice-peer-connection-start-honesty", () => {
  it("PB1-C: maps a failed peer-connection start to interrupted honesty", () => {
    expect(resolveVoicePeerConnectionStartFailureUi()).toEqual({
      phase: "interrupted",
      reasonCode: "session_closed",
      toastKey: "messaging.voiceCallJoinConnectionFailed",
      logStatus: "peer_connection_start_failed",
    });
  });
});
