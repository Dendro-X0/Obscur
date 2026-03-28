import { describe, expect, it } from "vitest";
import {
  resolveVoiceInviteTombstoneVerdict,
  VOICE_INVITE_TOMBSTONE_GRACE_MS,
} from "@/app/features/messaging/services/realtime-voice-invite-tombstone";

describe("realtime voice invite tombstone verdict", () => {
  it("returns not tombstoned when no leave tombstone exists", () => {
    expect(resolveVoiceInviteTombstoneVerdict({
      leftAtUnixMs: null,
      invitedAtUnixMs: 1200,
    })).toEqual({
      tombstoned: false,
      leftAtUnixMs: null,
      invitedAtUnixMs: 1200,
    });
  });

  it("marks tombstoned when leave exists and invite timestamp is missing", () => {
    expect(resolveVoiceInviteTombstoneVerdict({
      leftAtUnixMs: 5000,
      invitedAtUnixMs: null,
    })).toEqual({
      tombstoned: true,
      leftAtUnixMs: 5000,
      invitedAtUnixMs: null,
    });
  });

  it("marks tombstoned when leave overlaps invite within grace window", () => {
    const invitedAtUnixMs = 10_000;
    const leftAtUnixMs = invitedAtUnixMs - VOICE_INVITE_TOMBSTONE_GRACE_MS;
    expect(resolveVoiceInviteTombstoneVerdict({
      leftAtUnixMs,
      invitedAtUnixMs,
    }).tombstoned).toBe(true);
  });

  it("does not mark tombstoned when leave is older than invite beyond grace window", () => {
    const invitedAtUnixMs = 10_000;
    const leftAtUnixMs = invitedAtUnixMs - VOICE_INVITE_TOMBSTONE_GRACE_MS - 1;
    expect(resolveVoiceInviteTombstoneVerdict({
      leftAtUnixMs,
      invitedAtUnixMs,
    }).tombstoned).toBe(false);
  });
});
