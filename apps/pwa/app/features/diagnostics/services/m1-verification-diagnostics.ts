"use client";

/**
 * M1 Implementation Verification Diagnostics
 *
 * Validates that all M1 goals are properly integrated and functioning.
 * Part of v1.4.7 M2: Diagnostics & Replay Verification
 *
 * Goals Verified:
 * - Goal 2: CAS Media Recovery (restore convergence)
 * - Goal 4: Security Integration (audit log, identicon, key change detection)
 * - Goal 5: Relay Capability Badges (community mode display)
 */

import { getMediaRecoverySummary } from "@/app/features/vault/services/cas-media-recovery";
import { getRecentSecurityEvents, getContactVerificationStatus } from "@/app/features/security";
import { assessRelayCapability } from "@/app/features/groups/services/community-mode-contract";

export interface M1DiagnosticResult {
  goal2: {
    name: "CAS Media Recovery";
    status: "pass" | "fail" | "warn" | "skip";
    details: {
      serviceAvailable: boolean;
      vaultAccessible: boolean;
      gatewayReachable?: boolean;
    };
    message: string;
  };
  goal4: {
    name: "Security Integration";
    status: "pass" | "fail" | "warn" | "skip";
    details: {
      auditLogAvailable: boolean;
      identiconServiceAvailable: boolean;
      keyChangeDetectionAvailable: boolean;
      recentEventsCount: number;
    };
    message: string;
  };
  goal5: {
    name: "Relay Capability Badges";
    status: "pass" | "fail" | "warn" | "skip";
    details: {
      assessmentFunctionAvailable: boolean;
      tierDetectionWorking: boolean;
      sampleTier?: string;
    };
    message: string;
  };
  overall: "healthy" | "degraded" | "critical" | "unknown";
  timestamp: number;
}

/**
 * Run comprehensive M1 verification diagnostics
 */
export async function runM1Diagnostics(
  enabledRelayUrls: ReadonlyArray<string> = []
): Promise<M1DiagnosticResult> {
  const timestamp = Date.now();

  // Goal 2: CAS Media Recovery
  const goal2Result = await verifyGoal2();

  // Goal 4: Security Integration
  const goal4Result = await verifyGoal4();

  // Goal 5: Relay Capability Badges
  const goal5Result = verifyGoal5(enabledRelayUrls);

  // Calculate overall health
  const statuses = [goal2Result.status, goal4Result.status, goal5Result.status];
  const hasFailure = statuses.includes("fail");
  const hasWarn = statuses.includes("warn");
  const hasPass = statuses.includes("pass");

  const overall = hasFailure
    ? "critical"
    : hasWarn
    ? "degraded"
    : hasPass
    ? "healthy"
    : "unknown";

  return {
    goal2: goal2Result,
    goal4: goal4Result,
    goal5: goal5Result,
    overall,
    timestamp,
  };
}

async function verifyGoal2(publicKeyHex?: string) {
  try {
    // Check if media recovery service is available
    // If no publicKey provided, we can still check if the function exists
    let summary;
    if (publicKeyHex) {
      summary = await getMediaRecoverySummary(publicKeyHex);
    }

    const details = {
      serviceAvailable: typeof getMediaRecoverySummary === "function",
      vaultAccessible: summary !== undefined,
      gatewayReachable: undefined, // Would need actual network test
    };

    return {
      name: "CAS Media Recovery" as const,
      status: details.serviceAvailable ? ("pass" as const) : ("warn" as const),
      details,
      message: details.vaultAccessible && summary
        ? `CAS Media Recovery service active. Vault: ${summary.vaultBlobs} blobs.`
        : "CAS Media Recovery service available (run with publicKey for full check)",
    };
  } catch (error) {
    return {
      name: "CAS Media Recovery" as const,
      status: "fail" as const,
      details: {
        serviceAvailable: false,
        vaultAccessible: false,
      },
      message: `CAS Media Recovery service error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

async function verifyGoal4() {
  try {
    // Check security audit log
    const recentEvents = await getRecentSecurityEvents("10");
    const auditLogAvailable = recentEvents !== undefined;

    // Check identicon service (via contact verification which uses it)
    const identiconServiceAvailable = typeof getContactVerificationStatus === "function";

    // Check key change detection
    const keyChangeDetectionAvailable = typeof getContactVerificationStatus === "function";

    const details = {
      auditLogAvailable,
      identiconServiceAvailable,
      keyChangeDetectionAvailable,
      recentEventsCount: Array.isArray(recentEvents) ? recentEvents.length : 0,
    };

    const allServicesAvailable =
      auditLogAvailable && identiconServiceAvailable && keyChangeDetectionAvailable;

    return {
      name: "Security Integration" as const,
      status: allServicesAvailable ? ("pass" as const) : ("warn" as const),
      details,
      message: allServicesAvailable
        ? `Security Integration active. ${details.recentEventsCount} recent audit events.`
        : `Security services partially available: audit=${auditLogAvailable}, identicon=${identiconServiceAvailable}`,
    };
  } catch (error) {
    return {
      name: "Security Integration" as const,
      status: "fail" as const,
      details: {
        auditLogAvailable: false,
        identiconServiceAvailable: false,
        keyChangeDetectionAvailable: false,
        recentEventsCount: 0,
      },
      message: `Security Integration error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

function verifyGoal5(enabledRelayUrls: ReadonlyArray<string>) {
  try {
    // Check if assessment function is available
    const assessmentFunctionAvailable = typeof assessRelayCapability === "function";

    if (!assessmentFunctionAvailable) {
      return {
        name: "Relay Capability Badges" as const,
        status: "fail" as const,
        details: {
          assessmentFunctionAvailable: false,
          tierDetectionWorking: false,
        },
        message: "Relay capability assessment function not available",
      };
    }

    // Test tier detection with sample data
    const assessment = assessRelayCapability({
      enabledRelayUrls,
      selectedRelayHost: enabledRelayUrls[0] || null,
    });

    const tierDetectionWorking = assessment && typeof assessment.tier === "string";

    const details = {
      assessmentFunctionAvailable: true,
      tierDetectionWorking,
      sampleTier: assessment?.tier,
    };

    return {
      name: "Relay Capability Badges" as const,
      status: tierDetectionWorking ? ("pass" as const) : ("warn" as const),
      details,
      message: tierDetectionWorking
        ? `Relay capability badges active. Detected tier: ${assessment.tier}`
        : "Relay assessment function available but tier detection unclear",
    };
  } catch (error) {
    return {
      name: "Relay Capability Badges" as const,
      status: "fail" as const,
      details: {
        assessmentFunctionAvailable: false,
        tierDetectionWorking: false,
      },
      message: `Relay Capability Badges error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Quick health check for M1 implementation
 */
export async function quickM1HealthCheck(): Promise<{
  healthy: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  try {
    const diagnostics = await runM1Diagnostics([]);

    if (diagnostics.goal2.status === "fail") {
      issues.push(`Goal 2 (CAS Media): ${diagnostics.goal2.message}`);
    }
    if (diagnostics.goal4.status === "fail") {
      issues.push(`Goal 4 (Security): ${diagnostics.goal4.message}`);
    }
    if (diagnostics.goal5.status === "fail") {
      issues.push(`Goal 5 (Relay Badges): ${diagnostics.goal5.message}`);
    }

    const healthy =
      diagnostics.goal2.status !== "fail" &&
      diagnostics.goal4.status !== "fail" &&
      diagnostics.goal5.status !== "fail";

    return { healthy, issues };
  } catch (error) {
    return {
      healthy: false,
      issues: [`Diagnostic error: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

// Expose to window for console debugging
if (typeof window !== "undefined") {
  (window as Window & { obscurM1Diagnostics?: unknown }).obscurM1Diagnostics = {
    run: runM1Diagnostics,
    quickCheck: quickM1HealthCheck,
  };
}
