/**
 * Relay Trust Scorer Service
 * 
 * Tracks relay behavior metrics and assigns trust scores based on:
 * - Message delivery success rate
 * - Response latency
 * - Uptime percentage
 * - User reports
 */

import { createSecurityAuditLog, type SecurityAuditLog } from "./security-audit-log";

export type RelayTrustLevel = "high" | "medium" | "low" | "untrusted";

export interface RelayMetrics {
  url: string;
  totalAttempts: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  avgLatencyMs: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  consecutiveFailures: number;
  firstSeenAt: number;
  userReports: "none" | "suspicious" | "blocked";
}

export interface RelayScore {
  url: string;
  trustLevel: RelayTrustLevel;
  deliveryRate: number; // 0-100
  healthScore: number; // 0-100 composite
  metrics: RelayMetrics;
  recommendation: "keep" | "watch" | "replace";
}

const STORE_NAME = "relay_trust_scores";

/**
 * Calculate composite health score (0-100)
 */
function calculateHealthScore(metrics: RelayMetrics): number {
  if (metrics.totalAttempts === 0) return 50; // Neutral for new relays

  // Delivery rate weight: 50%
  const deliveryRate = metrics.totalAttempts > 0
    ? (metrics.successfulDeliveries / metrics.totalAttempts) * 100
    : 0;

  // Latency score weight: 25%
  const latencyScore = metrics.avgLatencyMs > 0
    ? Math.max(0, 100 - (metrics.avgLatencyMs / 20)) // 0ms=100, 2000ms=0
    : 50;

  // Stability score weight: 25%
  const stabilityScore = Math.max(0, 100 - metrics.consecutiveFailures * 20);

  // User report penalty
  let userReportPenalty = 0;
  if (metrics.userReports === "suspicious") userReportPenalty = 30;
  if (metrics.userReports === "blocked") userReportPenalty = 100;

  const rawScore = deliveryRate * 0.5 + latencyScore * 0.25 + stabilityScore * 0.25;
  return Math.max(0, rawScore - userReportPenalty);
}

/**
 * Determine trust level from metrics
 */
function determineTrustLevel(metrics: RelayMetrics, healthScore: number): RelayTrustLevel {
  if (metrics.userReports === "blocked") return "untrusted";
  if (healthScore >= 85) return "high";
  if (healthScore >= 60) return "medium";
  if (healthScore >= 30) return "low";
  return "untrusted";
}

/**
 * Get recommendation based on metrics
 */
function getRecommendation(metrics: RelayMetrics, trustLevel: RelayTrustLevel): RelayScore["recommendation"] {
  if (trustLevel === "high") return "keep";
  if (trustLevel === "medium") return "watch";
  return "replace";
}

/**
 * Relay Trust Scorer
 */
export class RelayTrustScorer {
  private myPublicKey: string;
  private auditLog: SecurityAuditLog;
  private metrics: Map<string, RelayMetrics> = new Map();

  constructor(myPublicKey: string) {
    this.myPublicKey = myPublicKey;
    this.auditLog = createSecurityAuditLog(myPublicKey);
  }

  /**
   * Initialize from storage
   */
  async initialize(): Promise<void> {
    try {
      const { openMessageDb } = await import("../../messaging/lib/open-message-db");
      const db = await openMessageDb();

      const stored = await new Promise<Record<string, RelayMetrics> | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get("relay_metrics");

        request.onsuccess = () => resolve(request.result as Record<string, RelayMetrics>);
        request.onerror = () => reject(request.error);
      });

      if (stored) {
        this.metrics = new Map(Object.entries(stored));
      }
    } catch (error) {
      console.error("Failed to initialize relay trust scorer:", error);
    }
  }

  /**
   * Persist metrics to storage
   */
  private async persist(): Promise<void> {
    try {
      const { openMessageDb } = await import("../../messaging/lib/open-message-db");
      const db = await openMessageDb();

      const data = Object.fromEntries(this.metrics);

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(data, "relay_metrics");

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Failed to persist relay metrics:", error);
    }
  }

  /**
   * Record a successful relay delivery
   */
  async recordSuccess(relayUrl: string, latencyMs: number): Promise<void> {
    await this.initialize();

    const existing = this.metrics.get(relayUrl);
    const now = Date.now();

    if (existing) {
      existing.totalAttempts++;
      existing.successfulDeliveries++;
      existing.lastSuccessAt = now;
      existing.consecutiveFailures = 0;
      
      // Update rolling average latency
      const oldAvg = existing.avgLatencyMs;
      const newCount = existing.successfulDeliveries;
      existing.avgLatencyMs = (oldAvg * (newCount - 1) + latencyMs) / newCount;
    } else {
      this.metrics.set(relayUrl, {
        url: relayUrl,
        totalAttempts: 1,
        successfulDeliveries: 1,
        failedDeliveries: 0,
        avgLatencyMs: latencyMs,
        lastSuccessAt: now,
        lastFailureAt: null,
        consecutiveFailures: 0,
        firstSeenAt: now,
        userReports: "none",
      });
    }

    await this.persist();
  }

  /**
   * Record a failed relay delivery
   */
  async recordFailure(relayUrl: string, errorType: string): Promise<void> {
    await this.initialize();

    const existing = this.metrics.get(relayUrl);
    const now = Date.now();

    if (existing) {
      existing.totalAttempts++;
      existing.failedDeliveries++;
      existing.lastFailureAt = now;
      existing.consecutiveFailures++;
    } else {
      this.metrics.set(relayUrl, {
        url: relayUrl,
        totalAttempts: 1,
        successfulDeliveries: 0,
        failedDeliveries: 1,
        avgLatencyMs: 0,
        lastSuccessAt: null,
        lastFailureAt: now,
        consecutiveFailures: 1,
        firstSeenAt: now,
        userReports: "none",
      });
    }

    await this.persist();

    // Log to audit if multiple consecutive failures
    const updated = this.metrics.get(relayUrl)!;
    if (updated.consecutiveFailures >= 3) {
      await this.auditLog.logEvent(
        "relay_failure",
        "warning",
        `Relay ${relayUrl} has ${updated.consecutiveFailures} consecutive failures`,
        { relayUrl, consecutiveFailures: updated.consecutiveFailures, errorType }
      );
    }
  }

  /**
   * Get score for a specific relay
   */
  getScore(relayUrl: string): RelayScore | null {
    const metrics = this.metrics.get(relayUrl);
    if (!metrics) return null;

    const healthScore = calculateHealthScore(metrics);
    const deliveryRate = metrics.totalAttempts > 0
      ? (metrics.successfulDeliveries / metrics.totalAttempts) * 100
      : 0;

    return {
      url: relayUrl,
      trustLevel: determineTrustLevel(metrics, healthScore),
      deliveryRate,
      healthScore,
      metrics,
      recommendation: getRecommendation(metrics, determineTrustLevel(metrics, healthScore)),
    };
  }

  /**
   * Get all relay scores
   */
  getAllScores(): RelayScore[] {
    return Array.from(this.metrics.keys())
      .map((url) => this.getScore(url))
      .filter((s): s is RelayScore => s !== null)
      .sort((a, b) => b.healthScore - a.healthScore);
  }

  /**
   * Get best relay for fallback
   */
  getBestFallback(excludeUrl?: string): RelayScore | null {
    const scores = this.getAllScores()
      .filter((s) => s.url !== excludeUrl)
      .filter((s) => s.trustLevel !== "untrusted");

    return scores.length > 0 ? scores[0] : null;
  }

  /**
   * Report relay as suspicious
   */
  async reportSuspicious(relayUrl: string, reason: string): Promise<void> {
    await this.initialize();

    const metrics = this.metrics.get(relayUrl);
    if (metrics) {
      metrics.userReports = "suspicious";
      await this.persist();
    }

    await this.auditLog.logEvent(
      "suspicious_connection",
      "warning",
      `Relay ${relayUrl} reported as suspicious: ${reason}`,
      { relayUrl, reason }
    );
  }

  /**
   * Block a relay
   */
  async blockRelay(relayUrl: string, reason: string): Promise<void> {
    await this.initialize();

    const metrics = this.metrics.get(relayUrl);
    if (metrics) {
      metrics.userReports = "blocked";
      await this.persist();
    }

    await this.auditLog.logEvent(
      "relay_switch",
      "critical",
      `Relay ${relayUrl} blocked: ${reason}`,
      { relayUrl, reason }
    );
  }

  /**
   * Get summary statistics
   */
  getSummary(): {
    totalRelays: number;
    highTrust: number;
    mediumTrust: number;
    lowTrust: number;
    untrusted: number;
    needsAttention: RelayScore[];
  } {
    const scores = this.getAllScores();
    const needsAttention = scores.filter(
      (s) => s.recommendation === "replace" || s.metrics.consecutiveFailures >= 3
    );

    return {
      totalRelays: scores.length,
      highTrust: scores.filter((s) => s.trustLevel === "high").length,
      mediumTrust: scores.filter((s) => s.trustLevel === "medium").length,
      lowTrust: scores.filter((s) => s.trustLevel === "low").length,
      untrusted: scores.filter((s) => s.trustLevel === "untrusted").length,
      needsAttention,
    };
  }

  /**
   * Reset metrics for a relay (e.g., after configuration change)
   */
  async resetMetrics(relayUrl: string): Promise<void> {
    await this.initialize();
    this.metrics.delete(relayUrl);
    await this.persist();
  }

  /**
   * Clear all metrics
   */
  async clearAllMetrics(): Promise<void> {
    this.metrics.clear();
    await this.persist();
  }
}

/**
 * Create relay trust scorer instance
 */
export function createRelayTrustScorer(myPublicKey: string): RelayTrustScorer {
  return new RelayTrustScorer(myPublicKey);
}
