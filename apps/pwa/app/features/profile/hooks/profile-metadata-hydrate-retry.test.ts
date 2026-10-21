import { describe, expect, it } from "vitest";
import {
  PROFILE_METADATA_HYDRATE_MAX_ATTEMPTS,
  countOpenRelayConnections,
  nextProfileMetadataHydrateDelayMs,
  shouldRetryProfileMetadataOnPoolRecovery,
  shouldScheduleProfileMetadataHydrateRetry,
} from "./profile-metadata-hydrate-retry";

describe("profile-metadata-hydrate-retry", () => {
  it("returns backoff delays then null", () => {
    expect(nextProfileMetadataHydrateDelayMs(0)).toBe(2_000);
    expect(nextProfileMetadataHydrateDelayMs(1)).toBe(5_000);
    expect(nextProfileMetadataHydrateDelayMs(3)).toBe(30_000);
    expect(nextProfileMetadataHydrateDelayMs(4)).toBeNull();
  });

  it("schedules retry only while hydration still needed under attempt cap", () => {
    expect(shouldScheduleProfileMetadataHydrateRetry({
      needsHydration: true,
      live: true,
      hasRelayUrls: true,
      attemptCount: 0,
      appliedRelayKind0: false,
    })).toBe(true);
    expect(shouldScheduleProfileMetadataHydrateRetry({
      needsHydration: true,
      live: true,
      hasRelayUrls: true,
      attemptCount: PROFILE_METADATA_HYDRATE_MAX_ATTEMPTS,
      appliedRelayKind0: false,
    })).toBe(false);
    expect(shouldScheduleProfileMetadataHydrateRetry({
      needsHydration: true,
      live: true,
      hasRelayUrls: true,
      attemptCount: 1,
      appliedRelayKind0: true,
    })).toBe(false);
    expect(shouldScheduleProfileMetadataHydrateRetry({
      needsHydration: false,
      live: true,
      hasRelayUrls: true,
      attemptCount: 0,
      appliedRelayKind0: false,
    })).toBe(false);
  });

  it("keeps retrying when only a local displayName seed exists (no relay kind-0 yet)", () => {
    expect(shouldScheduleProfileMetadataHydrateRetry({
      needsHydration: true,
      live: true,
      hasRelayUrls: true,
      attemptCount: 1,
      appliedRelayKind0: false,
    })).toBe(true);
  });

  it("retries on pool open-count recovery while still needing hydration", () => {
    expect(shouldRetryProfileMetadataOnPoolRecovery({
      needsHydration: true,
      previousOpenCount: 1,
      nextOpenCount: 2,
    })).toBe(true);
    expect(shouldRetryProfileMetadataOnPoolRecovery({
      needsHydration: true,
      previousOpenCount: 2,
      nextOpenCount: 2,
    })).toBe(false);
    expect(shouldRetryProfileMetadataOnPoolRecovery({
      needsHydration: false,
      previousOpenCount: 1,
      nextOpenCount: 3,
    })).toBe(false);
  });

  it("counts open relay connections", () => {
    expect(countOpenRelayConnections([
      { status: "open" },
      { status: "connecting" },
      { status: "open" },
    ])).toBe(2);
  });
});
