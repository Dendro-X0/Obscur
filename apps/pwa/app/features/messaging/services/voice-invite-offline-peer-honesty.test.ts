import { describe, expect, it } from "vitest";
import { shouldWarnOfflinePeerBeforeVoiceInviteDial } from "./voice-invite-offline-peer-honesty";

describe("shouldWarnOfflinePeerBeforeVoiceInviteDial", () => {
  it("warns only when presence is explicitly offline", () => {
    expect(shouldWarnOfflinePeerBeforeVoiceInviteDial({ peerIsOnline: false })).toBe(true);
    expect(shouldWarnOfflinePeerBeforeVoiceInviteDial({ peerIsOnline: true })).toBe(false);
    expect(shouldWarnOfflinePeerBeforeVoiceInviteDial({ peerIsOnline: null })).toBe(false);
    expect(shouldWarnOfflinePeerBeforeVoiceInviteDial({ peerIsOnline: undefined })).toBe(false);
  });
});
