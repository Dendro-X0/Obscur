import { describe, expect, it } from "vitest";
import {
  resolveVoiceInviteBootstrapReplayDecision,
  resolveVoiceSignalBootstrapReplayDecision,
} from "./realtime-voice-history-replay-policy";

const FIVE_MIN_MS = 5 * 60 * 1000;

describe("MED-002 — realtime voice history replay policy", () => {
  describe("resolveVoiceSignalBootstrapReplayDecision", () => {
    it("quarantines fresh restored signals on bootstrap pass", () => {
      expect(resolveVoiceSignalBootstrapReplayDecision({
        isBootstrapPass: true,
        signalAgeMs: 30_000,
        maxSignalAgeMs: FIVE_MIN_MS,
        activeSessionMatches: false,
        pendingInviteMatches: false,
        statusMatches: false,
      })).toEqual({
        shouldReplay: false,
        reasonCode: "bootstrap_history_quarantined",
      });
    });

    it("resumes when an active session already matches", () => {
      expect(resolveVoiceSignalBootstrapReplayDecision({
        isBootstrapPass: true,
        signalAgeMs: 30_000,
        maxSignalAgeMs: FIVE_MIN_MS,
        activeSessionMatches: true,
        pendingInviteMatches: false,
        statusMatches: false,
      }).shouldReplay).toBe(true);
    });

    it("accepts live signals after bootstrap when within age budget", () => {
      expect(resolveVoiceSignalBootstrapReplayDecision({
        isBootstrapPass: false,
        signalAgeMs: 30_000,
        maxSignalAgeMs: FIVE_MIN_MS,
        activeSessionMatches: false,
        pendingInviteMatches: false,
        statusMatches: false,
      })).toEqual({
        shouldReplay: true,
        reasonCode: "accept",
      });
    });
  });

  describe("resolveVoiceInviteBootstrapReplayDecision", () => {
    it("quarantines fresh restored invites on bootstrap pass", () => {
      expect(resolveVoiceInviteBootstrapReplayDecision({
        isBootstrapPass: true,
        inviteAgeMs: 30_000,
        maxInviteAgeMs: FIVE_MIN_MS,
        statusMatches: false,
      })).toEqual({
        shouldReplay: false,
        reasonCode: "bootstrap_history_quarantined",
      });
    });

    it("accepts live invites after bootstrap when within age budget", () => {
      expect(resolveVoiceInviteBootstrapReplayDecision({
        isBootstrapPass: false,
        inviteAgeMs: 30_000,
        maxInviteAgeMs: FIVE_MIN_MS,
        statusMatches: false,
      })).toEqual({
        shouldReplay: true,
        reasonCode: "accept",
      });
    });
  });
});
