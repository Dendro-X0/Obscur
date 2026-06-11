import { beforeEach, describe, expect, it } from "vitest";
import {
  getDmTrustPeerState,
  getPeerConnectionRequestCountLastDay,
  recordPeerConnectionRequest,
} from "./dm-kernel-trust-peer-state";
import { INVITE_FANOUT_THRESHOLD } from "./dm-kernel-trust-spam-signals";

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
});
