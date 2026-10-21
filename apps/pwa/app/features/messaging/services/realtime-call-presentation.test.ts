import { describe, expect, it } from "vitest";
import {
  isVoiceCallAvStagePhase,
  resolveVoiceCallPresentation,
} from "./realtime-call-presentation";

describe("resolveVoiceCallPresentation", () => {
  it("keeps voice on the compact dock on every shell", () => {
    expect(resolveVoiceCallPresentation({
      isMobileShell: true,
      callType: "voice",
      phase: "connected",
    })).toBe("dock");
    expect(resolveVoiceCallPresentation({
      isMobileShell: false,
      callType: "voice",
      phase: "connected",
    })).toBe("dock");
  });

  it("keeps outgoing/incoming video ring on the dock (no stage until peer engages)", () => {
    expect(resolveVoiceCallPresentation({
      isMobileShell: false,
      callType: "video",
      phase: "ringing_outgoing",
    })).toBe("dock");
    expect(resolveVoiceCallPresentation({
      isMobileShell: true,
      callType: "video",
      phase: "ringing_outgoing",
    })).toBe("dock");
    expect(resolveVoiceCallPresentation({
      isMobileShell: false,
      callType: "video",
      phase: "interrupted",
    })).toBe("dock");
    expect(isVoiceCallAvStagePhase("ringing_outgoing")).toBe(false);
  });

  it("uses fullscreen/stage only after connecting or connected", () => {
    expect(resolveVoiceCallPresentation({
      isMobileShell: true,
      callType: "video",
      phase: "connecting",
    })).toBe("fullscreen");
    expect(resolveVoiceCallPresentation({
      isMobileShell: false,
      callType: "video",
      phase: "connected",
    })).toBe("stage");
    expect(isVoiceCallAvStagePhase("connecting")).toBe(true);
    expect(isVoiceCallAvStagePhase("connected")).toBe(true);
  });
});
