import { describe, expect, it } from "vitest";
import {
  isVoiceCallInviteVideoRequested,
  preserveVoiceCallMediaFields,
} from "./voice-call-ui-status-preserve";

describe("preserveVoiceCallMediaFields", () => {
  it("keeps callType/mediaMode for the same room", () => {
    expect(preserveVoiceCallMediaFields({
      roomId: "room-a",
      callType: "video",
      mediaMode: "av",
    }, "room-a")).toEqual({
      callType: "video",
      mediaMode: "av",
    });
  });

  it("drops media fields when room changes", () => {
    expect(preserveVoiceCallMediaFields({
      roomId: "room-a",
      callType: "video",
      mediaMode: "av",
    }, "room-b")).toEqual({});
  });
});

describe("isVoiceCallInviteVideoRequested", () => {
  it("detects video/av callType and capabilities.video", () => {
    expect(isVoiceCallInviteVideoRequested({ callType: "video" })).toBe(true);
    expect(isVoiceCallInviteVideoRequested({ callType: "av" })).toBe(true);
    expect(isVoiceCallInviteVideoRequested({ capabilities: { video: true } })).toBe(true);
    expect(isVoiceCallInviteVideoRequested({ callType: "voice" })).toBe(false);
    expect(isVoiceCallInviteVideoRequested({})).toBe(false);
  });
});
