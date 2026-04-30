import { describe, expect, it } from "vitest";
import {
  resolveBootstrappedVoiceInviteReplayDecision,
  resolveBootstrappedVoiceSignalReplayDecision,
} from "./realtime-voice-history-replay-policy";

describe("realtime-voice-history-replay-policy", () => {
  it("treats bootstrapped signal history as static when no live voice state matches", () => {
    expect(resolveBootstrappedVoiceSignalReplayDecision({
      activeSessionMatches: false,
      pendingInviteMatches: false,
      statusMatches: false,
    })).toEqual({
      shouldReplay: false,
      reasonCode: "historical_restore_static",
    });
  });

  it("allows bootstrapped signal replay only for matching live voice state", () => {
    expect(resolveBootstrappedVoiceSignalReplayDecision({
      activeSessionMatches: true,
      pendingInviteMatches: false,
      statusMatches: false,
    })).toEqual({
      shouldReplay: true,
      reasonCode: "active_session_match",
    });
    expect(resolveBootstrappedVoiceSignalReplayDecision({
      activeSessionMatches: false,
      pendingInviteMatches: true,
      statusMatches: false,
    })).toEqual({
      shouldReplay: true,
      reasonCode: "pending_invite_match",
    });
    expect(resolveBootstrappedVoiceSignalReplayDecision({
      activeSessionMatches: false,
      pendingInviteMatches: false,
      statusMatches: true,
    })).toEqual({
      shouldReplay: true,
      reasonCode: "ui_status_match",
    });
  });

  it("treats bootstrapped invite history as static unless matching incoming UI already exists", () => {
    const now = Date.now();
    expect(resolveBootstrappedVoiceInviteReplayDecision({
      statusMatches: false,
      nowUnixMs: now,
    })).toEqual({
      shouldReplay: false,
      reasonCode: "historical_restore_static",
    });
    expect(resolveBootstrappedVoiceInviteReplayDecision({
      statusMatches: true,
      nowUnixMs: now,
    })).toEqual({
      shouldReplay: true,
      reasonCode: "ui_status_match",
    });
  });

  it("rejects expired invites based on expiresAtUnixMs", () => {
    const now = 1000000;
    expect(resolveBootstrappedVoiceInviteReplayDecision({
      statusMatches: false,
      expiresAtUnixMs: now - 1000, // Expired 1 second ago
      nowUnixMs: now,
    })).toEqual({
      shouldReplay: false,
      reasonCode: "invite_expired",
    });
  });

  it("rejects historical invites older than 5 minutes to prevent ghost calls", () => {
    const now = Date.now();
    const sixMinutesAgo = now - 6 * 60 * 1000;
    expect(resolveBootstrappedVoiceInviteReplayDecision({
      statusMatches: false,
      invitedAtUnixMs: sixMinutesAgo,
      nowUnixMs: now,
    })).toEqual({
      shouldReplay: false,
      reasonCode: "invite_too_old",
    });
  });

  it("accepts recent invites even when status doesn't match", () => {
    const now = Date.now();
    const oneMinuteAgo = now - 1 * 60 * 1000;
    // Recent invite should be treated as static (not replayed) during bootstrap
    // unless there's a matching UI status
    expect(resolveBootstrappedVoiceInviteReplayDecision({
      statusMatches: false,
      invitedAtUnixMs: oneMinuteAgo,
      nowUnixMs: now,
    })).toEqual({
      shouldReplay: false,
      reasonCode: "historical_restore_static",
    });
  });

  it("accepts recent invites when status matches (live call scenario)", () => {
    const now = Date.now();
    const oneMinuteAgo = now - 1 * 60 * 1000;
    expect(resolveBootstrappedVoiceInviteReplayDecision({
      statusMatches: true,
      invitedAtUnixMs: oneMinuteAgo,
      nowUnixMs: now,
    })).toEqual({
      shouldReplay: true,
      reasonCode: "ui_status_match",
    });
  });
});
