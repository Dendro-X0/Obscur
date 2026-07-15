import { beforeEach, describe, expect, it } from "vitest";
import {
  getDmTrustPeerState,
  getPeerConnectionRequestCountLastDay,
  getPeerFirstSeenAtUnixMs,
  getPeerIncomingCountLastMinute,
  recordPeerConnectionRequest,
  recordPeerIncomingMessageAtPeerLevel,
} from "./dm-kernel-trust-peer-state";
import { INVITE_FANOUT_THRESHOLD, MSG_RATE_THRESHOLD } from "./dm-kernel-trust-spam-signals";

const PROFILE = "profile-test";
const PEER = "c".repeat(64);
const baseMs = 1_700_000_000_000;

describe("dm-kernel-trust-peer-state", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("records and counts connection requests in rolling day window", () => {
    for (let index = 0; index <= INVITE_FANOUT_THRESHOLD; index += 1) {
      recordPeerConnectionRequest(PROFILE, PEER, baseMs + index * 1_000);
    }
    expect(getPeerConnectionRequestCountLastDay(PROFILE, PEER, baseMs + 30_000)).toBe(
      INVITE_FANOUT_THRESHOLD + 1,
    );
  });

  it("prunes connection requests older than fanout window", () => {
    recordPeerConnectionRequest(PROFILE, PEER, baseMs - 25 * 60 * 60 * 1000);
    recordPeerConnectionRequest(PROFILE, PEER, baseMs);
    const state = getDmTrustPeerState(PROFILE, PEER, baseMs);
    expect(state.connectionRequestTimestampsUnixMs).toHaveLength(1);
  });

  it("records first seen timestamp on first peer interaction", () => {
    expect(getPeerFirstSeenAtUnixMs(PROFILE, PEER)).toBeNull();
    recordPeerIncomingMessageAtPeerLevel(PROFILE, PEER, baseMs);
    expect(getPeerFirstSeenAtUnixMs(PROFILE, PEER)).toBe(baseMs);
    recordPeerIncomingMessageAtPeerLevel(PROFILE, PEER, baseMs + 1_000);
    expect(getPeerFirstSeenAtUnixMs(PROFILE, PEER)).toBe(baseMs);
  });

  it("tracks cross-thread incoming messages for msg.rate", () => {
    for (let index = 0; index <= MSG_RATE_THRESHOLD; index += 1) {
      recordPeerIncomingMessageAtPeerLevel(PROFILE, PEER, baseMs + index * 500);
    }
    expect(getPeerIncomingCountLastMinute(PROFILE, PEER, baseMs + 30_000)).toBe(
      MSG_RATE_THRESHOLD + 1,
    );
  });
});
