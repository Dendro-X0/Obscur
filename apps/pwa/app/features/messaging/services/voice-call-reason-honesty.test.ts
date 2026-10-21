import { describe, expect, it } from "vitest";
import {
  resolveCallTypeFromInvite,
  resolveSupportedCallType,
  resolveVoiceCallReasonHonestyKey,
  shouldShowVideoCallPanes,
} from "./voice-call-reason-honesty";

describe("voice-call-reason-honesty", () => {
  it("maps interrupt reasons to honesty i18n keys", () => {
    expect(resolveVoiceCallReasonHonestyKey("network_interrupted")).toBe(
      "messaging.voiceCallReasonNetworkInterrupted",
    );
    expect(resolveVoiceCallReasonHonestyKey("session_closed")).toBe(
      "messaging.voiceCallReasonSessionClosed",
    );
    expect(resolveVoiceCallReasonHonestyKey(null)).toBeNull();
  });

  it("M1-A: coerces video to voice unless both peers advertise video", () => {
    expect(resolveSupportedCallType("video")).toBe("voice");
    expect(resolveSupportedCallType("av", { localSupportsVideo: true })).toBe("voice");
    expect(resolveSupportedCallType("video", {
      localSupportsVideo: true,
      remoteSupportsVideo: false,
    })).toBe("voice");
    expect(resolveSupportedCallType("video", {
      localSupportsVideo: true,
      remoteSupportsVideo: true,
    })).toBe("video");
    expect(resolveSupportedCallType("av", {
      localSupportsVideo: true,
      remoteSupportsVideo: true,
    })).toBe("video");
    expect(resolveSupportedCallType("voice", {
      localSupportsVideo: true,
      remoteSupportsVideo: true,
    })).toBe("voice");
    expect(resolveSupportedCallType(undefined)).toBe("voice");
  });

  it("M1-A: invite UI type follows wire intent (not local camera capability)", () => {
    expect(resolveCallTypeFromInvite({
      inviteCallType: "video",
      inviteAdvertisesVideo: true,
      localSupportsVideo: true,
    })).toBe("video");
    expect(resolveCallTypeFromInvite({
      inviteCallType: "video",
      inviteAdvertisesVideo: true,
      localSupportsVideo: false,
    })).toBe("video");
    expect(resolveCallTypeFromInvite({
      inviteCallType: "av",
      localSupportsVideo: false,
    })).toBe("video");
    expect(resolveCallTypeFromInvite({
      inviteCallType: "voice",
      inviteAdvertisesVideo: true,
      localSupportsVideo: true,
    })).toBe("video");
    expect(resolveCallTypeFromInvite({
      inviteCallType: "voice",
      localSupportsVideo: true,
    })).toBe("voice");
    expect(resolveCallTypeFromInvite({
      localSupportsVideo: true,
    })).toBe("voice");
  });

  it("M1-A: shows video dock panes only for negotiated video", () => {
    expect(shouldShowVideoCallPanes("video")).toBe(true);
    expect(shouldShowVideoCallPanes("voice")).toBe(false);
    expect(shouldShowVideoCallPanes(undefined)).toBe(false);
  });
});
