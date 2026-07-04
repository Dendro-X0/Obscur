import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  assessDmTrustWarning,
  BUNDLE_CONN_BURST,
  BUNDLE_FIN_COLD,
  BUNDLE_PHISH_COLD,
  FINANCIAL_PIVOT_WINDOW_MS,
  TRUST_BANNER_DISMISS_COOLDOWN_MS,
  type AssessDmTrustInput,
  type DmTrustAssessment,
  type TrustWarningTier,
} from "@/app/features/dm-kernel/dm-kernel-trust-assessment-port";
import { incomingRequestAntiAbuseInternals } from "@/app/features/messaging/services/incoming-request-anti-abuse";

/** Maps 1:1 to v1.9.5 Phase B manual matrix trust/spam rows — no live stranger spam required. */
export type DevLabTrustMatrixRowId =
  | "TRUST-1"
  | "TRUST-2"
  | "TRUST-3"
  | "TRUST-4"
  | "TRUST-5"
  | "TRUST-6"
  | "SPAM-1";

export const DEV_LAB_TRUST_MATRIX_ROW_IDS: ReadonlyArray<DevLabTrustMatrixRowId> = [
  "TRUST-1",
  "TRUST-2",
  "TRUST-3",
  "TRUST-4",
  "TRUST-5",
  "TRUST-6",
  "SPAM-1",
];

export type DevLabTrustMatrixRowExpect = Readonly<{
  tier: TrustWarningTier;
  bundleId: string | null;
  showBanner: boolean;
}>;

export type DevLabTrustMatrixRowDefinition = Readonly<{
  matrixRowId: DevLabTrustMatrixRowId;
  note: string;
  input: AssessDmTrustInput;
  expect: DevLabTrustMatrixRowExpect;
}>;

export type DevLabTrustMatrixRowResult = Readonly<{
  matrixRowId: DevLabTrustMatrixRowId;
  passed: boolean;
  issues: ReadonlyArray<string>;
  assessment: DmTrustAssessment;
}>;

export type DevLabTrustMatrixScenarioResult = Readonly<{
  ok: boolean;
  peerPublicKeyHex: PublicKeyHex;
  rows: ReadonlyArray<DevLabTrustMatrixRowResult>;
}>;

export const DEV_LAB_TRUST_MATRIX_BASE_MS = 1_700_100_000_000;

const tierShowsBanner = (tier: TrustWarningTier): boolean => (
  tier === "elevated" || tier === "critical"
);

const coldInput = (
  peerPublicKeyHex: PublicKeyHex,
  messageContent: string,
  offsetMs = 60_000,
  overrides: Partial<AssessDmTrustInput> = {},
): AssessDmTrustInput => ({
  peerPublicKeyHex,
  isPeerAccepted: false,
  messageContent,
  messageTimestampUnixMs: DEV_LAB_TRUST_MATRIX_BASE_MS + offsetMs,
  threadFirstPeerMessageAtUnixMs: DEV_LAB_TRUST_MATRIX_BASE_MS,
  dismissedUntilUnixMs: null,
  nowUnixMs: DEV_LAB_TRUST_MATRIX_BASE_MS + offsetMs,
  ...overrides,
});

export const buildDevLabTrustMatrixDefinitions = (
  peerPublicKeyHex: PublicKeyHex,
): ReadonlyArray<DevLabTrustMatrixRowDefinition> => [
  {
    matrixRowId: "TRUST-1",
    note: "Cold DM + financial mention → fin-cold banner on recipient",
    input: coldInput(
      peerPublicKeyHex,
      "Hi — can you send $200 via wire transfer today?",
    ),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD, showBanner: true },
  },
  {
    matrixRowId: "TRUST-2",
    note: "Dismiss cooldown suppresses repeat fin-cold banner",
    input: coldInput(peerPublicKeyHex, "Send $999 wire transfer now", 120_000, {
      dismissedUntilUnixMs: DEV_LAB_TRUST_MATRIX_BASE_MS + TRUST_BANNER_DISMISS_COOLDOWN_MS,
      nowUnixMs: DEV_LAB_TRUST_MATRIX_BASE_MS + 180_000,
      messageTimestampUnixMs: DEV_LAB_TRUST_MATRIX_BASE_MS + 120_000,
    }),
    expect: { tier: "none", bundleId: null, showBanner: false },
  },
  {
    matrixRowId: "TRUST-3",
    note: "Accepted established peer + benign invoice → no fin-cold false positive",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "Invoice for last month: $120 — thanks!",
      messageTimestampUnixMs: DEV_LAB_TRUST_MATRIX_BASE_MS + FINANCIAL_PIVOT_WINDOW_MS + 1,
      threadFirstPeerMessageAtUnixMs: DEV_LAB_TRUST_MATRIX_BASE_MS,
      dismissedUntilUnixMs: null,
      nowUnixMs: DEV_LAB_TRUST_MATRIX_BASE_MS + FINANCIAL_PIVOT_WINDOW_MS + 1,
    },
    expect: { tier: "none", bundleId: null, showBanner: false },
  },
  {
    matrixRowId: "TRUST-4",
    note: "Cold DM + credential-shaped URL → phish-cold banner",
    input: coldInput(
      peerPublicKeyHex,
      "Verify your account: https://example-security.test/login?ref=abc",
    ),
    expect: { tier: "elevated", bundleId: BUNDLE_PHISH_COLD, showBanner: true },
  },
  {
    matrixRowId: "TRUST-5",
    note: "Accepted peer + early financial mention + relaxed sensitivity → no fin-cold banner",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "Hi — can you send $200 via wire transfer today?",
      messageTimestampUnixMs: DEV_LAB_TRUST_MATRIX_BASE_MS + 60_000,
      threadFirstPeerMessageAtUnixMs: DEV_LAB_TRUST_MATRIX_BASE_MS,
      dismissedUntilUnixMs: null,
      contactTrustSensitivity: "relaxed",
      nowUnixMs: DEV_LAB_TRUST_MATRIX_BASE_MS + 60_000,
    },
    expect: { tier: "info", bundleId: null, showBanner: false },
  },
  {
    matrixRowId: "TRUST-6",
    note: "Accepted peer + early financial mention + vigilant sensitivity → fin-cold banner",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "Hi — can you send $200 via wire transfer today?",
      messageTimestampUnixMs: DEV_LAB_TRUST_MATRIX_BASE_MS + 60_000,
      threadFirstPeerMessageAtUnixMs: DEV_LAB_TRUST_MATRIX_BASE_MS,
      dismissedUntilUnixMs: null,
      contactTrustSensitivity: "vigilant",
      nowUnixMs: DEV_LAB_TRUST_MATRIX_BASE_MS + 60_000,
    },
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD, showBanner: true },
  },
  {
    matrixRowId: "SPAM-1",
    note: "Connection-request burst snapshot → conn-burst banner (anti-abuse convergence)",
    input: coldInput(peerPublicKeyHex, "following up on my invite", 90_000, {
      connectionRequestBurstSnapshot: {
        peerWindowCount: incomingRequestAntiAbuseInternals.PEER_LIMIT,
        peerLimit: incomingRequestAntiAbuseInternals.PEER_LIMIT,
        globalWindowCount: 1,
        globalLimit: incomingRequestAntiAbuseInternals.GLOBAL_LIMIT,
        windowMs: incomingRequestAntiAbuseInternals.WINDOW_MS,
        cooldownActive: false,
        cooldownRemainingMs: null,
      },
    }),
    expect: { tier: "elevated", bundleId: BUNDLE_CONN_BURST, showBanner: true },
  },
];

export const evaluateDevLabTrustMatrixRow = (
  definition: DevLabTrustMatrixRowDefinition,
): DevLabTrustMatrixRowResult => {
  const assessment = assessDmTrustWarning(definition.input);
  const issues: string[] = [];
  const { expect } = definition;

  if (assessment.tier !== expect.tier) {
    issues.push(`expected_tier_${expect.tier}_got_${assessment.tier}`);
  }
  if (assessment.bundleId !== expect.bundleId) {
    issues.push(`expected_bundle_${expect.bundleId ?? "null"}_got_${assessment.bundleId ?? "null"}`);
  }
  if (tierShowsBanner(assessment.tier) !== expect.showBanner) {
    issues.push(`expected_showBanner_${expect.showBanner}_got_${tierShowsBanner(assessment.tier)}`);
  }

  return {
    matrixRowId: definition.matrixRowId,
    passed: issues.length === 0,
    issues,
    assessment,
  };
};

export const evaluateDevLabTrustMatrixScenario = (
  peerPublicKeyHex: PublicKeyHex = "f".repeat(64) as PublicKeyHex,
): DevLabTrustMatrixScenarioResult => {
  const rows = buildDevLabTrustMatrixDefinitions(peerPublicKeyHex)
    .map((definition) => evaluateDevLabTrustMatrixRow(definition));
  return {
    ok: rows.every((row) => row.passed),
    peerPublicKeyHex,
    rows,
  };
};
