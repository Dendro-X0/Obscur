/**
 * Dev Lab digest gate policy — aligns with runtime-capture-lib risk thresholds.
 */

export type DigestRiskLevel = "none" | "watch" | "high";

export type CrossDeviceDigestSummary = Readonly<
  Record<string, Readonly<{ riskLevel?: DigestRiskLevel }>>
>;

export const readCrossDeviceDigestSummary = (digest: unknown): CrossDeviceDigestSummary => {
  const summary = (digest as { summary?: CrossDeviceDigestSummary } | null)?.summary;
  return summary ?? {};
};

const RISK_ORDER: Readonly<Record<DigestRiskLevel, number>> = {
  none: 0,
  watch: 1,
  high: 2,
};

export const isDigestRiskLevelAcceptable = (
  level: DigestRiskLevel | null | undefined,
  maxAllowed: DigestRiskLevel = "watch",
): boolean => {
  const normalized = level ?? "none";
  return RISK_ORDER[normalized] <= RISK_ORDER[maxAllowed];
};

export const DEV_LAB_MEMBERSHIP_DIGEST_KEYS = [
  "membershipSendability",
  "communityLifecycleConvergence",
] as const;

export type DevLabMembershipDigestKey = (typeof DEV_LAB_MEMBERSHIP_DIGEST_KEYS)[number];

export type MembershipDigestGateResult = Readonly<{
  passed: boolean;
  failures: ReadonlyArray<Readonly<{ key: DevLabMembershipDigestKey; riskLevel: DigestRiskLevel }>>;
  summaries: Readonly<Partial<Record<DevLabMembershipDigestKey, Readonly<{ riskLevel?: DigestRiskLevel }>>>>;
}>;

export const evaluateMembershipDigestGates = (
  summary: Readonly<Record<string, Readonly<{ riskLevel?: DigestRiskLevel }>>> | null | undefined,
  maxAllowed: DigestRiskLevel = "watch",
): MembershipDigestGateResult => {
  const failures: Array<{ key: DevLabMembershipDigestKey; riskLevel: DigestRiskLevel }> = [];
  const summaries: Partial<Record<DevLabMembershipDigestKey, Readonly<{ riskLevel?: DigestRiskLevel }>>> = {};

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
};

export const DEV_LAB_DM_CONTINUITY_DIGEST_KEY = "selfAuthoredDmContinuity";

export type DmContinuityDigestGateResult = Readonly<{
  passed: boolean;
  riskLevel: DigestRiskLevel;
}>;

export const evaluateDmContinuityDigestGate = (
  summary: Readonly<Record<string, Readonly<{ riskLevel?: DigestRiskLevel }>>> | null | undefined,
  maxAllowed: DigestRiskLevel = "watch",
): DmContinuityDigestGateResult => {
  const riskLevel = summary?.[DEV_LAB_DM_CONTINUITY_DIGEST_KEY]?.riskLevel ?? "none";
  return {
    passed: isDigestRiskLevelAcceptable(riskLevel, maxAllowed),
    riskLevel,
  };
};
