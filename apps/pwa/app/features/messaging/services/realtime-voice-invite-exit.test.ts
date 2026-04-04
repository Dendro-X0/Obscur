import { describe, expect, it } from "vitest";
import { resolveIncomingVoiceInviteExit } from "./realtime-voice-invite-exit";

describe("resolveIncomingVoiceInviteExit", () => {
  it("maps decline to ended and returns leave signal target", () => {
    const result = resolveIncomingVoiceInviteExit({
      pendingIncomingInvite: {
        peerPubkey: "a".repeat(64),
        invite: { roomId: "dm-voice-room-1" },
      },
      kind: "decline",
      canDispatchLeaveSignal: true,
      nowUnixMs: 101,
    });

    expect(result.nextStatus).toEqual({
      roomId: "dm-voice-room-1",
      peerPubkey: "a".repeat(64),
      phase: "ended",
      role: "joiner",
      sinceUnixMs: 101,
      reasonCode: "left_by_user",
    });
    expect(result.leaveSignalTarget).toEqual({
      roomId: "dm-voice-room-1",
      peerPubkey: "a".repeat(64),
    });
  });

  it("maps dismiss to interrupted and still returns leave signal target", () => {
    const result = resolveIncomingVoiceInviteExit({
      pendingIncomingInvite: {
        peerPubkey: "b".repeat(64),
        invite: { roomId: "dm-voice-room-2" },
      },
      kind: "dismiss",
      canDispatchLeaveSignal: true,
      nowUnixMs: 202,
    });

    expect(result.nextStatus).toEqual({
      roomId: "dm-voice-room-2",
      peerPubkey: "b".repeat(64),
      phase: "interrupted",
      role: "joiner",
      sinceUnixMs: 202,
      reasonCode: "session_closed",
    });
    expect(result.leaveSignalTarget).toEqual({
      roomId: "dm-voice-room-2",
      peerPubkey: "b".repeat(64),
    });
  });

  it("does not return leave signal target when identity cannot dispatch signals", () => {
    const result = resolveIncomingVoiceInviteExit({
      pendingIncomingInvite: {
        peerPubkey: "c".repeat(64),
        invite: { roomId: "dm-voice-room-3" },
      },
      kind: "decline",
      canDispatchLeaveSignal: false,
      nowUnixMs: 303,
    });

    expect(result.nextStatus?.phase).toBe("ended");
    expect(result.leaveSignalTarget).toBeNull();
  });

  it("returns null transitions when invite room is missing", () => {
    const result = resolveIncomingVoiceInviteExit({
      pendingIncomingInvite: {
        peerPubkey: "d".repeat(64),
        invite: {},
      },
      kind: "decline",
      canDispatchLeaveSignal: true,
      nowUnixMs: 404,
    });

    expect(result).toEqual({
      nextStatus: null,
      leaveSignalTarget: null,
    });
  });
});
