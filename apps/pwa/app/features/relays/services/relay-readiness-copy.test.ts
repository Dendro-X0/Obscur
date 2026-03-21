import { describe, expect, it } from "vitest";
import { getRelayReadinessBannerCopy, getRelaySendBlockCopy } from "./relay-readiness-copy";
import type { RelayRecoverySnapshot } from "./relay-recovery-policy";

const createSnapshot = (overrides: Partial<RelayRecoverySnapshot>): RelayRecoverySnapshot => ({
  readiness: "offline",
  writableRelayCount: 0,
  fallbackWritableRelayCount: 0,
  subscribableRelayCount: 0,
  writeBlockedRelayCount: 0,
  coolingDownRelayCount: 0,
  lastInboundMessageAtUnixMs: undefined,
  lastInboundEventAtUnixMs: undefined,
  lastSuccessfulPublishAtUnixMs: undefined,
  recoveryAttemptCount: 0,
  fallbackRelayUrls: [],
  ...overrides,
});

describe("relay-readiness-copy", () => {
  it("returns a blocking message when no writable relays exist", () => {
    const message = getRelaySendBlockCopy(createSnapshot({ readiness: "recovering" }));
    expect(message).toContain("recovering");
  });

  it("does not block when writable relays exist", () => {
    const message = getRelaySendBlockCopy(createSnapshot({ readiness: "degraded", writableRelayCount: 1 }));
    expect(message).toBeNull();
  });

  it("returns banner copy for degraded states", () => {
    const banner = getRelayReadinessBannerCopy(createSnapshot({ readiness: "degraded", writableRelayCount: 1 }));
    expect(banner).toContain("degraded");
  });
});
