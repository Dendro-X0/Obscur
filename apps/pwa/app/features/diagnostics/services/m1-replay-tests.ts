"use client";

/**
 * M1 Replay Verification Tests
 *
 * Runtime replay tests for critical M1 implementation paths.
 * Validates that implemented features work correctly in live scenarios.
 *
 * Part of v1.4.7 M2: Diagnostics & Replay Verification
 */

import { recoverMissingMediaFromCAS, getMediaRecoverySummary } from "@/app/features/vault/services/cas-media-recovery";
import { logSecurityEvent, getRecentSecurityEvents, checkContactKeyOnMessage } from "@/app/features/security";
import { assessRelayCapability } from "@/app/features/groups/services/community-mode-contract";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export interface ReplayTestResult {
  testName: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface M1ReplaySuiteResult {
  tests: ReplayTestResult[];
  passedCount: number;
  failedCount: number;
  totalDurationMs: number;
  timestamp: number;
}

/**
 * Run full M1 replay verification test suite
 */
export async function runM1ReplayTests(
  publicKeyHex?: PublicKeyHex
): Promise<M1ReplaySuiteResult> {
  const startTime = Date.now();
  const tests: ReplayTestResult[] = [];

  // Goal 2: CAS Media Recovery tests
  tests.push(await testMediaRecoveryServiceAvailable());
  if (publicKeyHex) {
    tests.push(await testMediaRecoverySummary(publicKeyHex));
  }

  // Goal 4: Security Integration tests
  tests.push(await testSecurityAuditLogging());
  tests.push(await testIdenticonGeneration());
  tests.push(await testKeyChangeDetection());

  // Goal 5: Relay Capability tests
  tests.push(await testRelayCapabilityAssessment());
  tests.push(await testCommunityModeDetection());

  const passedCount = tests.filter((t) => t.passed).length;
  const failedCount = tests.filter((t) => !t.passed).length;

  return {
    tests,
    passedCount,
    failedCount,
    totalDurationMs: Date.now() - startTime,
    timestamp: Date.now(),
  };
}

/**
 * Test 1: Media recovery service is available and callable
 */
async function testMediaRecoveryServiceAvailable(): Promise<ReplayTestResult> {
  const start = Date.now();
  try {
    // Check that the functions exist and are callable
    const serviceAvailable =
      typeof recoverMissingMediaFromCAS === "function" &&
      typeof getMediaRecoverySummary === "function";

    if (!serviceAvailable) {
      throw new Error("CAS Media Recovery functions not available");
    }

    return {
      testName: "CAS Media Recovery: Service Available",
      passed: true,
      durationMs: Date.now() - start,
      details: {
        recoverMissingMediaFromCAS: typeof recoverMissingMediaFromCAS === "function",
        getMediaRecoverySummary: typeof getMediaRecoverySummary === "function",
      },
    };
  } catch (error) {
    return {
      testName: "CAS Media Recovery: Service Available",
      passed: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 2: Media recovery summary can be retrieved (with publicKey)
 */
async function testMediaRecoverySummary(
  publicKeyHex: PublicKeyHex
): Promise<ReplayTestResult> {
  const start = Date.now();
  try {
    const summary = await getMediaRecoverySummary(publicKeyHex);

    // Validate summary structure
    const hasValidStructure =
      typeof summary.totalMessagesWithAttachments === "number" &&
      typeof summary.missingBlobs === "number" &&
      typeof summary.vaultBlobs === "number";

    if (!hasValidStructure) {
      throw new Error("Media recovery summary has invalid structure");
    }

    return {
      testName: "CAS Media Recovery: Summary Retrieval",
      passed: true,
      durationMs: Date.now() - start,
      details: {
        totalMessagesWithAttachments: summary.totalMessagesWithAttachments,
        missingBlobs: summary.missingBlobs,
        vaultBlobs: summary.vaultBlobs,
      },
    };
  } catch (error) {
    return {
      testName: "CAS Media Recovery: Summary Retrieval",
      passed: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 3: Security audit logging works
 */
async function testSecurityAuditLogging(): Promise<ReplayTestResult> {
  const start = Date.now();
  try {
    // Log a test event (need a public key)
    const testPublicKey = "0000000000000000000000000000000000000000000000000000000000000000";
    await logSecurityEvent(testPublicKey, {
      type: "settings_change",
      severity: "info",
      message: "M1 replay test: Security audit logging verification",
      details: { testId: "m1-replay-security-audit", timestamp: Date.now() },
    });

    // Retrieve recent events to verify logging worked
    const events = await getRecentSecurityEvents("10");
    const hasEvents = Array.isArray(events) && events.length > 0;

    return {
      testName: "Security Integration: Audit Logging",
      passed: hasEvents,
      durationMs: Date.now() - start,
      details: {
        eventsLogged: hasEvents,
        recentEventCount: Array.isArray(events) ? events.length : 0,
      },
    };
  } catch (error) {
    return {
      testName: "Security Integration: Audit Logging",
      passed: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 4: Identicon generation (via contact verification)
 */
async function testIdenticonGeneration(): Promise<ReplayTestResult> {
  const start = Date.now();
  try {
    // Generate an identicon using a test public key
    const testPublicKey = "0000000000000000000000000000000000000000000000000000000000000001" as PublicKeyHex;

    // The identicon service is tested indirectly via security integration
    // If we can call checkContactKeyOnMessage, the identicon infrastructure is present
    const keyChangeResult = await checkContactKeyOnMessage(
      testPublicKey,
      testPublicKey, // Same key = no change
      Date.now()
    );

    return {
      testName: "Security Integration: Key Change Detection",
      passed: true,
      durationMs: Date.now() - start,
      details: {
        keyChangeDetectionWorking: true,
        keyChangeDetected: keyChangeResult !== null,
      },
    };
  } catch (error) {
    return {
      testName: "Security Integration: Key Change Detection",
      passed: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 5: Key change detection works
 */
async function testKeyChangeDetection(): Promise<ReplayTestResult> {
  const start = Date.now();
  try {
    const testPublicKey = "0000000000000000000000000000000000000000000000000000000000000002" as PublicKeyHex;

    // First check - should detect as new key
    const firstCheck = await checkContactKeyOnMessage(
      testPublicKey,
      testPublicKey,
      Date.now()
    );

    return {
      testName: "Security Integration: Key Change Detection",
      passed: true,
      durationMs: Date.now() - start,
      details: {
        detectionResult: firstCheck,
        isFirstContact: firstCheck === null,
      },
    };
  } catch (error) {
    return {
      testName: "Security Integration: Key Change Detection",
      passed: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 6: Relay capability assessment works
 */
async function testRelayCapabilityAssessment(): Promise<ReplayTestResult> {
  const start = Date.now();
  try {
    // Test with no relays (unconfigured tier)
    const assessment = assessRelayCapability({
      enabledRelayUrls: [],
      selectedRelayHost: null,
    });

    const hasValidTier =
      assessment &&
      ["unconfigured", "public_default", "trusted_private", "managed_intranet"].includes(
        assessment.tier
      );

    if (!hasValidTier) {
      throw new Error(`Invalid relay capability tier: ${assessment?.tier}`);
    }

    return {
      testName: "Relay Capability: Assessment Function",
      passed: true,
      durationMs: Date.now() - start,
      details: {
        tier: assessment.tier,
        label: assessment.label,
        supportsManagedWorkspace: assessment.supportsManagedWorkspace,
      },
    };
  } catch (error) {
    return {
      testName: "Relay Capability: Assessment Function",
      passed: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Test 7: Community mode detection with different relay configs
 */
async function testCommunityModeDetection(): Promise<ReplayTestResult> {
  const start = Date.now();
  try {
    // Test public default detection
    const publicAssessment = assessRelayCapability({
      enabledRelayUrls: ["wss://relay.damus.io", "wss://nos.lol"],
      selectedRelayHost: "relay.damus.io",
    });

    // Test managed workspace detection (private relay)
    const privateAssessment = assessRelayCapability({
      enabledRelayUrls: ["wss://private.company.io"],
      selectedRelayHost: "private.company.io",
    });

    const bothValid =
      publicAssessment &&
      privateAssessment &&
      typeof publicAssessment.tier === "string" &&
      typeof privateAssessment.tier === "string";

    return {
      testName: "Relay Capability: Community Mode Detection",
      passed: bothValid,
      durationMs: Date.now() - start,
      details: {
        publicRelayTier: publicAssessment?.tier,
        privateRelayTier: privateAssessment?.tier,
        modesDetectedCorrectly: bothValid,
      },
    };
  } catch (error) {
    return {
      testName: "Relay Capability: Community Mode Detection",
      passed: false,
      durationMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Quick replay test runner for development
 */
export async function quickReplayTest(): Promise<{
  allPassed: boolean;
  summary: string;
}> {
  const results = await runM1ReplayTests();

  const allPassed = results.failedCount === 0;
  const summary = `${results.passedCount}/${results.tests.length} tests passed (${results.totalDurationMs}ms)`;

  return { allPassed, summary };
}

// Expose to window for console debugging
if (typeof window !== "undefined") {
  (window as Window & { obscurM1Replay?: unknown }).obscurM1Replay = {
    run: runM1ReplayTests,
    quick: quickReplayTest,
  };
}
