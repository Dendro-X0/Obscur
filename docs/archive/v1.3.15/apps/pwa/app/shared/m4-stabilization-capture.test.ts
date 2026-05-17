import { beforeEach, describe, expect, it, vi } from "vitest";
import { installM4StabilizationCapture, m4StabilizationCaptureInternals } from "./m4-stabilization-capture";

type MutableWindow = Window & Record<string, unknown>;

const getMutableWindow = (): MutableWindow => window as unknown as MutableWindow;

describe("m4-stabilization-capture", () => {
  beforeEach(() => {
    const root = getMutableWindow();
    delete root.obscurM4Stabilization;
    delete root.obscurAppEvents;
    delete root.obscurUiResponsiveness;
    delete root.obscurRouteMountDiagnostics;
    vi.restoreAllMocks();
  });

  it("installs global helper and captures search-jump stabilization evidence", () => {
    const root = getMutableWindow();
    root.obscurUiResponsiveness = {
      getSnapshot: () => ({ droppedFrameCount: 0 }),
    };
    root.obscurRouteMountDiagnostics = {
      getSnapshot: () => ({ recentSamples: [{ pathname: "/chat", elapsedMs: 25 }] }),
    };
    root.obscurAppEvents = {
      getCrossDeviceSyncDigest: () => ({
        summary: {
          searchJumpNavigation: {
            riskLevel: "watch",
            requestedCount: 3,
            resolvedCount: 2,
            unresolvedCount: 1,
            timestampFallbackResolvedCount: 1,
            domUnresolvedCount: 0,
            loadExhaustedUnresolvedCount: 1,
            latestResolutionMode: "timestamp_fallback",
            latestUnresolvedReasonCode: "target_not_found_after_load_attempts",
          },
        },
        recentWarnOrError: [{
          name: "messaging.search_jump_unresolved",
          level: "warn",
          atUnixMs: 10,
          reasonCode: "target_not_found_after_load_attempts",
        }],
      }),
      findByName: (name: string) => [{ name, atUnixMs: 11, level: "info" }],
    };

    installM4StabilizationCapture();

    const api = root.obscurM4Stabilization as {
      capture: (eventWindowSize?: number) => unknown;
      captureJson: (eventWindowSize?: number) => string;
    };
    expect(api).toBeTruthy();

    const bundle = api.capture(320) as {
      checks: { requiredApis: Record<string, boolean> };
      snapshots: Record<string, unknown>;
      searchJump: {
        summary: Record<string, unknown> | null;
        recentRequested: Array<{ name: string }>;
        recentResolved: Array<{ name: string }>;
        recentUnresolved: Array<{ name: string }>;
        recentWarnOrError: Array<{ reasonCode: string | null }>;
      };
    };
    expect(bundle.checks.requiredApis.appEvents).toBe(true);
    expect(bundle.checks.requiredApis.uiResponsiveness).toBe(true);
    expect(bundle.checks.requiredApis.routeMountDiagnostics).toBe(true);
    expect(bundle.snapshots.uiResponsiveness).toEqual({ droppedFrameCount: 0 });
    expect(bundle.snapshots.routeMountDiagnostics).toEqual({ recentSamples: [{ pathname: "/chat", elapsedMs: 25 }] });
    expect(bundle.searchJump.summary).toEqual(expect.objectContaining({
      riskLevel: "watch",
      requestedCount: 3,
      unresolvedCount: 1,
      latestResolutionMode: "timestamp_fallback",
    }));
    expect(bundle.searchJump.recentRequested[0]?.name).toBe("messaging.search_jump_requested");
    expect(bundle.searchJump.recentResolved[0]?.name).toBe("messaging.search_jump_resolved");
    expect(bundle.searchJump.recentUnresolved[0]?.name).toBe("messaging.search_jump_unresolved");
    expect(bundle.searchJump.recentWarnOrError[0]?.reasonCode).toBe("target_not_found_after_load_attempts");
    expect(() => JSON.parse(api.captureJson(320))).not.toThrow();
  });

  it("fails open when diagnostics APIs are unavailable", () => {
    const root = getMutableWindow();
    installM4StabilizationCapture();

    const api = root.obscurM4Stabilization as { capture: (eventWindowSize?: number) => unknown };
    const bundle = api.capture() as {
      checks: { requiredApis: Record<string, boolean> };
      snapshots: Record<string, unknown>;
      searchJump: {
        summary: unknown;
        recentRequested: unknown[];
        recentResolved: unknown[];
        recentUnresolved: unknown[];
        recentWarnOrError: unknown[];
      };
    };
    expect(bundle.checks.requiredApis.appEvents).toBe(false);
    expect(bundle.checks.requiredApis.uiResponsiveness).toBe(false);
    expect(bundle.checks.requiredApis.routeMountDiagnostics).toBe(false);
    expect(bundle.snapshots.uiResponsiveness).toBeNull();
    expect(bundle.snapshots.routeMountDiagnostics).toBeNull();
    expect(bundle.searchJump.summary).toBeNull();
    expect(bundle.searchJump.recentRequested).toEqual([]);
    expect(bundle.searchJump.recentResolved).toEqual([]);
    expect(bundle.searchJump.recentUnresolved).toEqual([]);
    expect(bundle.searchJump.recentWarnOrError).toEqual([]);
  });

  it("normalizes invalid event-window values", () => {
    expect(m4StabilizationCaptureInternals.toNumericWindowSize(480.7)).toBe(480);
    expect(m4StabilizationCaptureInternals.toNumericWindowSize(0)).toBe(1);
    expect(m4StabilizationCaptureInternals.toNumericWindowSize(Number.NaN)).toBe(400);
    expect(m4StabilizationCaptureInternals.toNumericWindowSize(undefined)).toBe(400);
  });

  it("rejects malformed search-jump summary payloads", () => {
    expect(m4StabilizationCaptureInternals.parseSearchJumpSummary(null)).toBeNull();
    expect(m4StabilizationCaptureInternals.parseSearchJumpSummary({ riskLevel: "broken" })).toBeNull();
    expect(m4StabilizationCaptureInternals.parseSearchJumpSummary({
      riskLevel: "high",
      requestedCount: 1,
      resolvedCount: 0,
      unresolvedCount: 1,
      timestampFallbackResolvedCount: 0,
      domUnresolvedCount: 1,
      loadExhaustedUnresolvedCount: 0,
      latestResolutionMode: "id",
      latestUnresolvedReasonCode: "target_dom_not_resolved_after_index_match",
    })).toEqual(expect.objectContaining({
      riskLevel: "high",
      requestedCount: 1,
      domUnresolvedCount: 1,
      latestResolutionMode: "id",
    }));
  });
});
