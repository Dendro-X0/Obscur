import { describe, expect, it } from "vitest";
import { shouldSuppressVoiceCallDockForPendingIncomingInvite } from "./realtime-voice-ui-visibility";

describe("shouldSuppressVoiceCallDockForPendingIncomingInvite", () => {
  it("returns true when pending incoming invite matches the ringing incoming dock status", () => {
    expect(shouldSuppressVoiceCallDockForPendingIncomingInvite({
      status: {
        roomId: "dm-voice-room-1",
        peerPubkey: "a".repeat(64),
        phase: "ringing_incoming",
      },
      pendingIncomingInvite: {
        peerPubkey: "a".repeat(64),
        invite: {
          roomId: "dm-voice-room-1",
        },
      },
    })).toBe(true);
  });

  it("returns false when there is no pending incoming invite", () => {
    expect(shouldSuppressVoiceCallDockForPendingIncomingInvite({
      status: {
        roomId: "dm-voice-room-1",
        peerPubkey: "a".repeat(64),
        phase: "ringing_incoming",
      },
      pendingIncomingInvite: null,
    })).toBe(false);
  });

  it("returns false when phase is not ringing incoming", () => {
    expect(shouldSuppressVoiceCallDockForPendingIncomingInvite({
      status: {
        roomId: "dm-voice-room-1",
        peerPubkey: "a".repeat(64),
        phase: "connecting",
      },
      pendingIncomingInvite: {
        peerPubkey: "a".repeat(64),
        invite: {
          roomId: "dm-voice-room-1",
        },
      },
    })).toBe(false);
  });

  it("returns false when invite and status belong to different calls", () => {
    expect(shouldSuppressVoiceCallDockForPendingIncomingInvite({
      status: {
        roomId: "dm-voice-room-1",
        peerPubkey: "a".repeat(64),
        phase: "ringing_incoming",
      },
      pendingIncomingInvite: {
        peerPubkey: "b".repeat(64),
        invite: {
          roomId: "dm-voice-room-2",
        },
      },
    })).toBe(false);
  });
});
