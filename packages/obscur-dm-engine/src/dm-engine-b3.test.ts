import { describe, expect, it, vi } from "vitest";
import { isDmMessageThreadOneSided, countDmMessageDirections } from "./dm-engine-integrity";
import { requestDmRelayBackfill } from "./dm-engine-repair";

describe("dm-engine integrity", () => {
  const myKey = "aa".repeat(32);
  const peerKey = "bb".repeat(32);

  it("detects one-sided sqlite threads", () => {
    expect(isDmMessageThreadOneSided([
      { senderPubkey: myKey },
      { senderPubkey: myKey },
    ], myKey)).toBe(true);
    expect(isDmMessageThreadOneSided([
      { senderPubkey: myKey },
      { senderPubkey: peerKey },
    ], myKey)).toBe(false);
  });

  it("counts directions without messaging types", () => {
    expect(countDmMessageDirections([
      { senderPubkey: myKey },
      { senderPubkey: peerKey },
    ], myKey)).toEqual({ outgoing: 1, incoming: 1, total: 2 });
  });
});

describe("dm-engine repair port", () => {
  it("schedules relay backfill only when kernel authority is active", async () => {
    const scheduleRelayBackfill = vi.fn(() => true);
    const result = await requestDmRelayBackfill({
      kernelAuthority: true,
      port: { scheduleRelayBackfill },
      request: {
        profileId: "default",
        conversationId: "dm:aa:bb",
        peerPubkey: peerKey(),
        reason: "cold_start",
      },
    });
    expect(result.requested).toBe(true);
    expect(scheduleRelayBackfill).toHaveBeenCalled();
  });

  it("skips repair when kernel authority is off", async () => {
    const scheduleRelayBackfill = vi.fn(() => true);
    const result = await requestDmRelayBackfill({
      kernelAuthority: false,
      port: { scheduleRelayBackfill },
      request: {
        profileId: "default",
        conversationId: "dm:aa:bb",
        peerPubkey: peerKey(),
        reason: "manual",
      },
    });
    expect(result.requested).toBe(false);
    expect(scheduleRelayBackfill).not.toHaveBeenCalled();
  });
});

const peerKey = (): string => "bb".repeat(32);
