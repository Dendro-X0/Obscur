import { describe, expect, it } from "vitest";
import {
  classifyStreamingUpdateInstallFailure,
  compareVersions,
  computeRolloutBucket,
  evaluateStreamingUpdateDecision,
  parseStreamingUpdateManifest,
} from "./streaming-update-policy";

const manifestFixture = {
  version: "1.3.8",
  channel: "stable",
  rolloutPercentage: 50,
  killSwitch: false,
  minSafeVersion: "1.3.6",
  artifacts: {
    "windows-x86_64": {
      url: "https://example.com/windows/setup.exe",
      signature: "minisign:signature",
      checksumSha256: "f".repeat(64),
    },
  },
} as const;

describe("streaming-update-policy", () => {
  it("parses valid manifest contract", () => {
    const parsed = parseStreamingUpdateManifest(manifestFixture);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.manifest.version).toBe("1.3.8");
      expect(parsed.manifest.rolloutPercentage).toBe(50);
    }
  });

  it("rejects malformed artifact checksum", () => {
    const parsed = parseStreamingUpdateManifest({
      ...manifestFixture,
      artifacts: {
        "windows-x86_64": {
          ...manifestFixture.artifacts["windows-x86_64"],
          checksumSha256: "abc",
        },
      },
    });
    expect(parsed.ok).toBe(false);
  });

  it("blocks updates when kill switch is active", () => {
    const parsed = parseStreamingUpdateManifest({
      ...manifestFixture,
      killSwitch: true,
      rolloutPercentage: 100,
    });
    if (!parsed.ok) {
      throw new Error(parsed.reason);
    }
    const decision = evaluateStreamingUpdateDecision({
      manifest: parsed.manifest,
      currentVersion: "1.3.7",
      channel: "stable",
      rolloutSeed: "device-a",
    });
    expect(decision).toEqual(expect.objectContaining({
      eligible: false,
      reasonCode: "kill_switch_active",
      rollbackBehavior: "preserve_current_version",
    }));
  });

  it("blocks rollout when bucket is above policy threshold", () => {
    const parsed = parseStreamingUpdateManifest({
      ...manifestFixture,
      rolloutPercentage: 0,
    });
    if (!parsed.ok) {
      throw new Error(parsed.reason);
    }
    const decision = evaluateStreamingUpdateDecision({
      manifest: parsed.manifest,
      currentVersion: "1.3.7",
      channel: "stable",
      rolloutSeed: "device-b",
    });
    expect(decision.eligible).toBe(false);
    expect(decision.reasonCode).toBe("rollout_holdback");
  });

  it("flags force update when current version is below min safe", () => {
    const parsed = parseStreamingUpdateManifest({
      ...manifestFixture,
      rolloutPercentage: 100,
      minSafeVersion: "1.3.7",
    });
    if (!parsed.ok) {
      throw new Error(parsed.reason);
    }
    const decision = evaluateStreamingUpdateDecision({
      manifest: parsed.manifest,
      currentVersion: "1.3.6",
      channel: "stable",
      rolloutSeed: "device-c",
    });
    expect(decision.eligible).toBe(true);
    expect(decision.forceUpdateRequired).toBe(true);
  });

  it("produces deterministic rollout buckets", () => {
    expect(computeRolloutBucket("abc")).toBe(computeRolloutBucket("abc"));
    expect(computeRolloutBucket("abc")).not.toBe(computeRolloutBucket("abd"));
  });

  it("classifies signature/checksum failures as verification-safe rollback", () => {
    const failure = classifyStreamingUpdateInstallFailure("Failed to install update: signature mismatch");
    expect(failure).toEqual({
      reasonCode: "verification_failed",
      preserveCurrentVersion: true,
      userMessage: "Update verification failed. Your current version is preserved for safety.",
    });
  });

  it("compares semver-like versions deterministically", () => {
    expect(compareVersions("1.3.7", "1.3.8")).toBe(-1);
    expect(compareVersions("1.3.8", "1.3.8")).toBe(0);
    expect(compareVersions("1.3.9", "1.3.8")).toBe(1);
  });
});
