/** Node mirror of apps/pwa/app/features/dev-lab/dev-lab-digest-policy.ts */

const RISK_ORDER = { none: 0, watch: 1, high: 2 };

export const DEV_LAB_MEMBERSHIP_DIGEST_KEYS = [
  "membershipSendability",
  "communityLifecycleConvergence",
];

/**
 * @param {"none" | "watch" | "high" | null | undefined} level
 * @param {"none" | "watch" | "high"} [maxAllowed]
 */
export function isDigestRiskLevelAcceptable(level, maxAllowed = "watch") {
  const normalized = level ?? "none";
  return RISK_ORDER[normalized] <= RISK_ORDER[maxAllowed];
}

/**
 * @param {Readonly<Record<string, Readonly<{ riskLevel?: string }>>> | null | undefined} summary
 * @param {"none" | "watch" | "high"} [maxAllowed]
 */
export function evaluateMembershipDigestGates(summary, maxAllowed = "watch") {
  /** @type {Array<{ key: string; riskLevel: string }>} */
  const failures = [];
  /** @type {Record<string, { riskLevel?: string }>} */
  const summaries = {};

  for (const key of DEV_LAB_MEMBERSHIP_DIGEST_KEYS) {
    const entry = summary?.[key];
    const riskLevel = entry?.riskLevel ?? "none";
    summaries[key] = entry ?? { riskLevel: "none" };
    if (!isDigestRiskLevelAcceptable(riskLevel, maxAllowed)) {
      failures.push({ key, riskLevel });
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    summaries,
  };
}
