import { beforeEach, describe, expect, it, vi } from "vitest";
import { installM8CommunityCapture } from "./m8-community-capture";
import { installM8CommunityReplayBridge } from "./m8-community-replay-bridge";

type MutableWindow = Window & Record<string, unknown>;

const getMutableWindow = (): MutableWindow => window as unknown as MutableWindow;

describe("m8-community-replay-bridge", () => {
  beforeEach(() => {
    const root = getMutableWindow();
    delete root.obscurM8CommunityReplay;
    delete root.obscurM8CommunityCapture;
    delete root.obscurAppEvents;
    (globalThis as Record<string, unknown>).__obscur_app_event_buffer__ = [];
    (globalThis as Record<string, unknown>).__obscur_log_hygiene_registry__ = new Map();
    vi.restoreAllMocks();
  });

  it("replays deterministic community convergence evidence and marks readiness", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    installM8CommunityCapture();
    installM8CommunityReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM8CommunityReplay as {
      runConvergenceReplay: (params?: {
        baseUnixMs?: number;
        clearAppEvents?: boolean;
      }) => {
        emittedEvents: {
          roomKeyMissingSendBlockedCount: number;
        };
        latestDigestSummary: {
          communityLifecycleConvergence: { recoveryRepairSignalCount: number } | null;
          membershipSendability: { roomKeyMissingSendBlockedCount: number } | null;
          accountSwitchScopeConvergence: { riskLevel: "none" | "watch" | "high" } | null;
        } | null;
        replayReadiness: {
          observedJoinedRoomKeyMismatch: boolean;
          readyForCp2Evidence: boolean;
          readyForCp3Evidence: boolean;
        } | null;
      };
    };

    const result = replayApi.runConvergenceReplay({
      baseUnixMs: 90_000,
      clearAppEvents: true,
    });

    expect(result.emittedEvents.roomKeyMissingSendBlockedCount).toBe(1);
    expect(result.latestDigestSummary?.communityLifecycleConvergence?.recoveryRepairSignalCount).toBeGreaterThan(0);
    expect(result.latestDigestSummary?.membershipSendability?.roomKeyMissingSendBlockedCount).toBe(1);
    expect(result.latestDigestSummary?.accountSwitchScopeConvergence?.riskLevel).toBe("none");
    expect(result.replayReadiness?.observedJoinedRoomKeyMismatch).toBe(true);
    expect(result.replayReadiness?.readyForCp2Evidence).toBe(true);
    expect(result.replayReadiness?.readyForCp3Evidence).toBe(true);
  });

  it("exports combined replay and capture JSON bundle with cp3 evidence gate verdict", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);

    installM8CommunityCapture();
    installM8CommunityReplayBridge();

    const root = getMutableWindow();
    const replayApi = root.obscurM8CommunityReplay as {
      runConvergenceReplayCapture: (params?: {
        baseUnixMs?: number;
        clearAppEvents?: boolean;
      }) => {
        cp3EvidenceGate?: {
          pass?: boolean;
          failedChecks?: readonly string[];
          checks?: {
            replayReadyForCp3?: boolean;
            captureReadyForCp3?: boolean;
          };
        };
      };
      runConvergenceReplayCaptureJson: (params?: {
        baseUnixMs?: number;
        clearAppEvents?: boolean;
      }) => string;
    };

    const payload = JSON.parse(replayApi.runConvergenceReplayCaptureJson({
      baseUnixMs: 91_000,
      clearAppEvents: true,
    })) as {
      replay?: { replayReadiness?: { readyForCp2Evidence?: boolean } };
      capture?: { community?: { replayReadiness?: { readyForCp2Evidence?: boolean; readyForCp3Evidence?: boolean } } };
      cp3EvidenceGate?: { pass?: boolean; checks?: { replayReadyForCp3?: boolean; captureReadyForCp3?: boolean } };
    };
    const rawCapture = replayApi.runConvergenceReplayCapture({
      baseUnixMs: 91_001,
      clearAppEvents: true,
    });

    expect(payload.replay?.replayReadiness?.readyForCp2Evidence).toBe(true);
    expect(payload.capture?.community?.replayReadiness?.readyForCp2Evidence).toBe(true);
    expect(payload.capture?.community?.replayReadiness?.readyForCp3Evidence).toBe(true);
    expect(payload.cp3EvidenceGate?.pass).toBe(true);
    expect(payload.cp3EvidenceGate?.checks?.replayReadyForCp3).toBe(true);
    expect(payload.cp3EvidenceGate?.checks?.captureReadyForCp3).toBe(true);
    expect(rawCapture.cp3EvidenceGate?.pass).toBe(true);
    expect(rawCapture.cp3EvidenceGate?.failedChecks ?? []).toHaveLength(0);
  });
});
