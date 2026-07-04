import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getRelayReadinessBannerCopy,
  getRelayReadinessDetailCopy,
  getRelayTransportQueueHint,
} from "./relay-readiness-copy";
import type { RelayRecoverySnapshot } from "./relay-recovery-types";

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
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("explains offline desktop shell when experiment stub is active", () => {
    vi.stubEnv("NEXT_PUBLIC_DESKTOP_SHELL", "1");
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE", "0");
    const banner = getRelayReadinessBannerCopy(createSnapshot({ readiness: "offline" }));
    expect(banner).toMatch(/offline mode/i);
    expect(banner).toMatch(/dev:desktop:online/i);
  });

  it("returns a queue hint when no writable relays exist", () => {
    const message = getRelayTransportQueueHint(createSnapshot({ readiness: "recovering" }));
    expect(message).toMatch(/queue/i);
  });

  it("returns no hint when writable relays exist", () => {
    const message = getRelayTransportQueueHint(createSnapshot({ readiness: "degraded", writableRelayCount: 1 }));
    expect(message).toBeNull();
  });

  it("mentions queued sends in offline banner copy", () => {
    const banner = getRelayReadinessBannerCopy(createSnapshot({ readiness: "offline" }));
    expect(banner).toMatch(/queue/i);
  });

  it("suppresses banner copy during startup warmup", () => {
    const banner = getRelayReadinessBannerCopy(createSnapshot({
      readiness: "offline",
      recoveryReasonCode: "startup_warmup",
    }));
    expect(banner).toBeNull();
  });

  it("returns banner copy for degraded states", () => {
    const banner = getRelayReadinessBannerCopy(createSnapshot({ readiness: "degraded", writableRelayCount: 1 }));
    expect(banner).toContain("degraded");
  });

  it("returns settings detail copy with writable counts", () => {
    const detail = getRelayReadinessDetailCopy(createSnapshot({
      readiness: "offline",
      writableRelayCount: 0,
      subscribableRelayCount: 1,
    }));
    expect(detail).toMatch(/offline/i);
    expect(detail).toMatch(/0 writable/);
  });
});
