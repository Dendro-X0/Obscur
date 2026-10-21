import { describe, expect, it } from "vitest";
import {
  isVideoCallInviteRequest,
  preserveVoiceCallUiStatusMedia,
} from "./voice-call-ui-status-media";

describe("preserveVoiceCallUiStatusMedia", () => {
  it("keeps callType/mediaMode for the same room", () => {
    expect(preserveVoiceCallUiStatusMedia({
      roomId: "room-a",
      previous: { roomId: "room-a", callType: "video", mediaMode: "av" },
    })).toEqual({ callType: "video", mediaMode: "av" });
  });

  it("drops media fields when room changes or previous missing", () => {
    expect(preserveVoiceCallUiStatusMedia({
      roomId: "room-b",
      previous: { roomId: "room-a", callType: "video" },
    })).toEqual({});
    expect(preserveVoiceCallUiStatusMedia({
      roomId: "room-a",
      previous: null,
    })).toEqual({});
  });
});

describe("isVideoCallInviteRequest", () => {
  it("detects video/av callType and capability bit", () => {
    expect(isVideoCallInviteRequest({ callType: "video" })).toBe(true);
    expect(isVideoCallInviteRequest({ callType: "av" })).toBe(true);
    expect(isVideoCallInviteRequest({ advertisesVideo: true })).toBe(true);
    expect(isVideoCallInviteRequest({ callType: "voice" })).toBe(false);
    expect(isVideoCallInviteRequest({})).toBe(false);
  });
});
