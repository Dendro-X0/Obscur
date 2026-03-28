import { describe, expect, it } from "vitest";
import {
  createVoiceCallSignalPayload,
  isVoiceCallControlPayload,
  parseVoiceCallInvitePayload,
  parseVoiceCallSignalPayload,
  stripVoiceCallControlPreview,
} from "./realtime-voice-signaling";

describe("realtime-voice-signaling", () => {
  it("parses valid voice-call signal payloads", () => {
    const payload = {
      type: "voice-call-signal",
      version: 1,
      roomId: "dm-voice-room-a",
      signalType: "offer",
      fromPubkey: "f".repeat(64),
      toPubkey: "t".repeat(64),
      sdp: {
        type: "offer",
        sdp: "v=0",
      },
      sentAtUnixMs: 1234,
    };
    const parsed = parseVoiceCallSignalPayload(JSON.stringify(payload));
    expect(parsed).toEqual(payload);
  });

  it("returns null for non-signal payload", () => {
    expect(parseVoiceCallSignalPayload(JSON.stringify({ type: "voice-call-invite" }))).toBeNull();
  });

  it("builds signal payload with defaults", () => {
    const built = createVoiceCallSignalPayload({
      roomId: "room-x",
      signalType: "join-request",
      fromPubkey: "a".repeat(64),
    });
    expect(built.type).toBe("voice-call-signal");
    expect(built.version).toBe(1);
    expect(built.roomId).toBe("room-x");
    expect(built.signalType).toBe("join-request");
    expect(built.fromPubkey).toBe("a".repeat(64));
    expect(typeof built.sentAtUnixMs).toBe("number");
  });

  it("parses voice-call invite payload", () => {
    const parsed = parseVoiceCallInvitePayload(JSON.stringify({
      type: "voice-call-invite",
      version: 1,
      roomId: "room-z",
      invitedAtUnixMs: 777,
      expiresAtUnixMs: 888,
      fromPubkey: "b".repeat(64),
    }));
    expect(parsed).toEqual({
      type: "voice-call-invite",
      version: 1,
      roomId: "room-z",
      invitedAtUnixMs: 777,
      expiresAtUnixMs: 888,
      fromPubkey: "b".repeat(64),
    });
  });

  it("detects voice-call control payloads", () => {
    expect(isVoiceCallControlPayload(JSON.stringify({
      type: "voice-call-signal",
      version: 1,
      roomId: "room-a",
      signalType: "join-request",
      fromPubkey: "f".repeat(64),
      sentAtUnixMs: 1,
    }))).toBe(true);
    expect(isVoiceCallControlPayload(JSON.stringify({
      type: "voice-call-invite",
      roomId: "room-a",
    }))).toBe(true);
    expect(isVoiceCallControlPayload("hello world")).toBe(false);
  });

  it("strips preview text for voice-call control payloads", () => {
    expect(stripVoiceCallControlPreview(JSON.stringify({
      type: "voice-call-signal",
      version: 1,
      roomId: "room-a",
      signalType: "leave",
      fromPubkey: "f".repeat(64),
      sentAtUnixMs: 2,
    }))).toBe("");
    expect(stripVoiceCallControlPreview("normal message")).toBe("normal message");
  });
});
