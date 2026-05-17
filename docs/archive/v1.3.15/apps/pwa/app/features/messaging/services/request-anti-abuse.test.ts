import { describe, expect, it, beforeEach, vi } from "vitest";
import { clearRequestCooldown, getRequestCooldownRemainingMs, setRequestCooldown } from "./request-anti-abuse";

const me = "a".repeat(64);
const peer = "b".repeat(64);

describe("request anti-abuse cooldown", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("returns zero when no cooldown exists", () => {
    expect(getRequestCooldownRemainingMs({ myPublicKeyHex: me as any, peerPublicKeyHex: peer as any })).toBe(0);
  });

  it("tracks active cooldown and clears after expiration", () => {
    vi.useFakeTimers();
    setRequestCooldown({
      myPublicKeyHex: me as any,
      peerPublicKeyHex: peer as any,
      reason: "declined",
      durationMs: 2000
    });
    expect(getRequestCooldownRemainingMs({ myPublicKeyHex: me as any, peerPublicKeyHex: peer as any })).toBeGreaterThan(0);
    vi.advanceTimersByTime(2500);
    expect(getRequestCooldownRemainingMs({ myPublicKeyHex: me as any, peerPublicKeyHex: peer as any })).toBe(0);
  });

  it("can clear cooldown manually", () => {
    setRequestCooldown({
      myPublicKeyHex: me as any,
      peerPublicKeyHex: peer as any,
      reason: "canceled",
      durationMs: 30_000
    });
    clearRequestCooldown({ myPublicKeyHex: me as any, peerPublicKeyHex: peer as any });
    expect(getRequestCooldownRemainingMs({ myPublicKeyHex: me as any, peerPublicKeyHex: peer as any })).toBe(0);
  });
});
