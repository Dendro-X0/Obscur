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
    expect(resolveBootstrappedVoiceInviteReplayDecision({
      statusMatches: false,
    })).toEqual({
      shouldReplay: false,
      reasonCode: "historical_restore_static",
    });
    expect(resolveBootstrappedVoiceInviteReplayDecision({
      statusMatches: true,
    })).toEqual({
      shouldReplay: true,
      reasonCode: "ui_status_match",
    });
  });
});
