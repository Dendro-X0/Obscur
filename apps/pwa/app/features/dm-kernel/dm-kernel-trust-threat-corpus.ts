import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  assessDmTrustWarning,
  BUNDLE_FIN_COLD,
  BUNDLE_SPAM_COLD,
  FINANCIAL_PIVOT_WINDOW_MS,
  TRUST_BANNER_DISMISS_COOLDOWN_MS,
  type AssessDmTrustInput,
  type DmTrustAssessment,
  type TrustSignalId,
  type TrustWarningTier,
} from "./dm-kernel-trust-assessment-port";
import {
  INVITE_FANOUT_THRESHOLD,
  MSG_RATE_THRESHOLD,
} from "./dm-kernel-trust-spam-signals";

export type TrustThreatCategory =
  | "benign"
  | "financial"
  | "phishing"
  | "urgency"
  | "spam"
  | "coordination"
  | "edge"
  | "manual_matrix";

export type TrustThreatFixtureExpect = Readonly<{
  tier?: TrustWarningTier;
  bundleId?: string | null;
  notBundleId?: string;
  mustIncludeSignals?: ReadonlyArray<TrustSignalId>;
  mustExcludeSignals?: ReadonlyArray<TrustSignalId>;
  copyKey?: string;
}>;

export type TrustThreatFixtureDefinition = Readonly<{
  id: string;
  category: TrustThreatCategory;
  note?: string;
  input: AssessDmTrustInput;
  expect: TrustThreatFixtureExpect;
}>;

export type TrustThreatFixtureCaseResult = Readonly<{
  id: string;
  category: TrustThreatCategory;
  passed: boolean;
  issues: ReadonlyArray<string>;
  assessment: DmTrustAssessment;
}>;

export type TrustThreatCorpusResult = Readonly<{
  ok: boolean;
  peerPublicKeyHex: PublicKeyHex;
  cases: ReadonlyArray<TrustThreatFixtureCaseResult>;
  byCategory: Readonly<Record<TrustThreatCategory, number>>;
}>;

/** Stable clock for deterministic corpus — not wall time. */
export const THREAT_CORPUS_BASE_MS = 1_700_000_000_000;

const defaultPeer = (): PublicKeyHex => "c".repeat(64) as PublicKeyHex;

const coldThreadInput = (
  peerPublicKeyHex: PublicKeyHex,
  messageContent: string,
  offsetMs = 60_000,
  overrides: Partial<AssessDmTrustInput> = {},
): AssessDmTrustInput => ({
  peerPublicKeyHex,
  isPeerAccepted: false,
  messageContent,
  messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + offsetMs,
  threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
  dismissedUntilUnixMs: null,
  nowUnixMs: THREAT_CORPUS_BASE_MS + offsetMs,
  ...overrides,
});

export const buildTrustThreatFixtureDefinitions = (
  peerPublicKeyHex: PublicKeyHex = defaultPeer(),
): ReadonlyArray<TrustThreatFixtureDefinition> => [
  // —— Manual matrix TRUST-1..3 ——
  {
    id: "trust_1_fin_cold_elevated",
    category: "manual_matrix",
    note: "TRUST-1 cold DM + financial mention",
    input: coldThreadInput(peerPublicKeyHex, "Hi — can you send $200 via wire transfer today?"),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "trust_2_dismiss_suppresses_banner",
    category: "manual_matrix",
    note: "TRUST-2 dismiss/snooze suppresses repeat banner",
    input: coldThreadInput(peerPublicKeyHex, "Send $999 wire transfer now", 120_000, {
      dismissedUntilUnixMs: THREAT_CORPUS_BASE_MS + TRUST_BANNER_DISMISS_COOLDOWN_MS,
      nowUnixMs: THREAT_CORPUS_BASE_MS + 180_000,
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + 120_000,
    }),
    expect: { tier: "none", bundleId: null },
  },
  {
    id: "trust_3_accepted_peer_no_fin_cold",
    category: "manual_matrix",
    note: "TRUST-3 established contact benign invoice outside pivot window",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "Invoice for last month: $120 — thanks!",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + FINANCIAL_PIVOT_WINDOW_MS + 1,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + FINANCIAL_PIVOT_WINDOW_MS + 1,
    },
    expect: { tier: "none", notBundleId: BUNDLE_FIN_COLD },
  },

  // —— Benign / low false-positive guards ——
  {
    id: "benign_cold_greeting_info_only",
    category: "benign",
    input: coldThreadInput(peerPublicKeyHex, "Hey — saw your post. Nice work on the relay guide."),
    expect: {
      tier: "info",
      bundleId: null,
      mustIncludeSignals: ["contact.cold"],
      mustExcludeSignals: ["thread.pivot_financial"],
    },
  },
  {
    id: "benign_accepted_peer_small_talk",
    category: "benign",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "Can we sync tomorrow on the deployment checklist?",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + 3600_000,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + 3600_000,
    },
    expect: { tier: "none", bundleId: null },
  },
  {
    id: "benign_accepted_peer_financial_inside_window_info",
    category: "benign",
    note: "Financial mention on trusted thread stays below fin-cold bundle",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "Splitting dinner — can you venmo me $42?",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + 120_000,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + 120_000,
    },
    expect: {
      tier: "info",
      notBundleId: BUNDLE_FIN_COLD,
      mustIncludeSignals: ["thread.pivot_financial"],
      mustExcludeSignals: ["contact.cold"],
    },
  },
  {
    id: "benign_urgency_without_financial_cold_info",
    category: "benign",
    note: "Urgency alone does not surface fin-cold; info tier collapses to contact.cold in port v1",
    input: coldThreadInput(peerPublicKeyHex, "Need your review asap before the maintainer call."),
    expect: {
      tier: "info",
      notBundleId: BUNDLE_FIN_COLD,
      mustIncludeSignals: ["contact.cold"],
      mustExcludeSignals: ["thread.pivot_financial"],
    },
  },

  // —— Financial scam templates ——
  {
    id: "financial_usdt_wallet_cold",
    category: "financial",
    input: coldThreadInput(peerPublicKeyHex, "Send 500 USDT to 0x" + "a".repeat(40) + " now"),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "financial_btc_address_cold",
    category: "financial",
    input: coldThreadInput(peerPublicKeyHex, "Deposit BTC to bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "financial_wire_transfer_cold",
    category: "financial",
    input: coldThreadInput(peerPublicKeyHex, "Please complete the bank transfer for $3,500 today."),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "financial_paypal_invoice_cold",
    category: "financial",
    input: coldThreadInput(peerPublicKeyHex, "PayPal invoice pending — pay $899 via payment link."),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "financial_cashapp_cold",
    category: "financial",
    input: coldThreadInput(peerPublicKeyHex, "CashApp $250 to unlock your account access."),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "financial_send_money_phrase_cold",
    category: "financial",
    input: coldThreadInput(peerPublicKeyHex, "Please send the funds before the window closes."),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "financial_eth_mention_cold",
    category: "financial",
    input: coldThreadInput(peerPublicKeyHex, "Transfer 2 ETH to settle the smart contract fee."),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },

  // —— Phishing-shaped (rule-pack v1: URL-only stays below fin-cold) ——
  {
    id: "phishing_wallet_verify_url_cold_info",
    category: "phishing",
    note: "Documents v1 gap — credential URL without financial keywords",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Verify your wallet at https://obscur-wallet-security.example/login?session=abc",
    ),
    expect: {
      tier: "info",
      notBundleId: BUNDLE_FIN_COLD,
      mustIncludeSignals: ["contact.cold"],
      mustExcludeSignals: ["thread.pivot_financial"],
    },
  },
  {
    id: "phishing_bitly_support_cold_info",
    category: "phishing",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Support ticket — confirm identity: http://bit.ly/secure-account-reset",
    ),
    expect: { tier: "info", notBundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "phishing_impersonation_support_cold_info",
    category: "phishing",
    input: coldThreadInput(
      peerPublicKeyHex,
      "This is Obscur Security — your relay certificate expired. Reply with your recovery phrase.",
    ),
    expect: { tier: "info", notBundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "phishing_financial_plus_url_critical",
    category: "phishing",
    note: "Financial pivot + urgency on phishing landing",
    input: coldThreadInput(
      peerPublicKeyHex,
      "Urgent: wire $500 immediately — https://pay-secure-portal.example/invoice",
      45_000,
    ),
    expect: { tier: "critical", bundleId: BUNDLE_FIN_COLD },
  },

  // —— Urgency pressure escalations ——
  {
    id: "urgency_limited_time_financial_critical",
    category: "urgency",
    input: coldThreadInput(peerPublicKeyHex, "Limited time: send $150 via wire transfer within 24 hours"),
    expect: { tier: "critical", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "urgency_act_now_financial_critical",
    category: "urgency",
    input: coldThreadInput(peerPublicKeyHex, "Act now — PayPal $75 payment link expires today"),
    expect: { tier: "critical", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "urgency_deadline_financial_critical",
    category: "urgency",
    input: coldThreadInput(peerPublicKeyHex, "Deadline today: send the payment of $600 ASAP"),
    expect: { tier: "critical", bundleId: BUNDLE_FIN_COLD },
  },

  // —— Spam / burst shapes ——
  {
    id: "spam_cold_burst_bundle_spam_cold",
    category: "spam",
    input: coldThreadInput(peerPublicKeyHex, "promo burst", 30_000, {
      peerIncomingCountLastMinute: MSG_RATE_THRESHOLD + 1,
    }),
    expect: { tier: "elevated", bundleId: BUNDLE_SPAM_COLD, copyKey: "messaging.trust.spamCold" },
  },
  {
    id: "spam_accepted_burst_msg_rate_only",
    category: "spam",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "flood segment",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      peerIncomingCountLastMinute: MSG_RATE_THRESHOLD + 5,
      nowUnixMs: THREAT_CORPUS_BASE_MS,
    },
    expect: {
      tier: "elevated",
      bundleId: null,
      mustIncludeSignals: ["msg.rate"],
      copyKey: "messaging.trust.msgRate",
    },
  },
  {
    id: "spam_identical_payload_burst",
    category: "spam",
    input: coldThreadInput(peerPublicKeyHex, "FREE AIRDROP CLICK NOW", 20_000, {
      peerIncomingCountLastMinute: MSG_RATE_THRESHOLD + 2,
    }),
    expect: { tier: "elevated", bundleId: BUNDLE_SPAM_COLD },
  },
  {
    id: "spam_below_rate_threshold_no_elevation",
    category: "spam",
    input: coldThreadInput(peerPublicKeyHex, "single ping", 10_000, {
      peerIncomingCountLastMinute: MSG_RATE_THRESHOLD,
    }),
    expect: { tier: "info", notBundleId: BUNDLE_SPAM_COLD },
  },

  // —— Coordination / fanout metadata ——
  {
    id: "coordination_invite_fanout_cold",
    category: "coordination",
    input: coldThreadInput(peerPublicKeyHex, "please accept my connection request", 5_000, {
      peerConnectionRequestCountLastDay: INVITE_FANOUT_THRESHOLD + 1,
    }),
    expect: {
      tier: "elevated",
      mustIncludeSignals: ["invite.fanout"],
      copyKey: "messaging.trust.inviteFanout",
    },
  },
  {
    id: "coordination_fanout_plus_financial_fin_cold",
    category: "coordination",
    note: "Fanout spammer pivots to financial ask",
    input: coldThreadInput(peerPublicKeyHex, "Send $50 USDT — hurry", 15_000, {
      peerConnectionRequestCountLastDay: INVITE_FANOUT_THRESHOLD + 3,
    }),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "coordination_fanout_below_threshold_info",
    category: "coordination",
    input: coldThreadInput(peerPublicKeyHex, "adding you to my network", 8_000, {
      peerConnectionRequestCountLastDay: INVITE_FANOUT_THRESHOLD,
    }),
    expect: { tier: "info", mustExcludeSignals: ["invite.fanout"] },
  },

  // —— Edge / boundary ——
  {
    id: "edge_financial_at_pivot_window_boundary_outside",
    category: "edge",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: false,
      messageContent: "Wire transfer $100 for the license",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + FINANCIAL_PIVOT_WINDOW_MS + 1,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + FINANCIAL_PIVOT_WINDOW_MS + 1,
    },
    expect: { tier: "info", notBundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "edge_financial_at_pivot_window_boundary_inside",
    category: "edge",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: false,
      messageContent: "Wire transfer $100 for the license",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + FINANCIAL_PIVOT_WINDOW_MS,
      threadFirstPeerMessageAtUnixMs: THREAT_CORPUS_BASE_MS,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + FINANCIAL_PIVOT_WINDOW_MS,
    },
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "edge_dismiss_expired_warns_again",
    category: "edge",
    input: coldThreadInput(peerPublicKeyHex, "Send $300 wire transfer", 200_000, {
      dismissedUntilUnixMs: THREAT_CORPUS_BASE_MS + 50_000,
      nowUnixMs: THREAT_CORPUS_BASE_MS + 200_000,
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + 200_000,
    }),
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
  {
    id: "edge_accepted_null_thread_anchor_still_cold",
    category: "edge",
    input: {
      peerPublicKeyHex,
      isPeerAccepted: true,
      messageContent: "Pay $25 via venmo",
      messageTimestampUnixMs: THREAT_CORPUS_BASE_MS + 30_000,
      threadFirstPeerMessageAtUnixMs: null,
      dismissedUntilUnixMs: null,
      nowUnixMs: THREAT_CORPUS_BASE_MS + 30_000,
    },
    expect: { tier: "elevated", bundleId: BUNDLE_FIN_COLD },
  },
];

export const evaluateTrustThreatFixture = (
  definition: TrustThreatFixtureDefinition,
): TrustThreatFixtureCaseResult => {
  const assessment = assessDmTrustWarning(definition.input);
  const issues: string[] = [];
  const { expect } = definition;

  if (expect.tier !== undefined && assessment.tier !== expect.tier) {
    issues.push(`expected_tier_${expect.tier}_got_${assessment.tier}`);
  }
  if (expect.bundleId !== undefined && assessment.bundleId !== expect.bundleId) {
    issues.push(`expected_bundle_${expect.bundleId}_got_${assessment.bundleId ?? "null"}`);
  }
  if (expect.notBundleId !== undefined && assessment.bundleId === expect.notBundleId) {
    issues.push(`unexpected_bundle_${expect.notBundleId}`);
  }
  if (expect.copyKey !== undefined && assessment.copyKey !== expect.copyKey) {
    issues.push(`expected_copyKey_${expect.copyKey}_got_${assessment.copyKey}`);
  }
  for (const signal of expect.mustIncludeSignals ?? []) {
    if (!assessment.activeSignals.includes(signal)) {
      issues.push(`missing_signal_${signal}`);
    }
  }
  for (const signal of expect.mustExcludeSignals ?? []) {
    if (assessment.activeSignals.includes(signal)) {
      issues.push(`unexpected_signal_${signal}`);
    }
  }

  return {
    id: definition.id,
    category: definition.category,
    passed: issues.length === 0,
    issues,
    assessment,
  };
};

export const evaluateTrustThreatCorpus = (
  peerPublicKeyHex: PublicKeyHex = defaultPeer(),
): TrustThreatCorpusResult => {
  const definitions = buildTrustThreatFixtureDefinitions(peerPublicKeyHex);
  const cases = definitions.map((definition) => evaluateTrustThreatFixture(definition));

  const byCategory = {
    benign: 0,
    financial: 0,
    phishing: 0,
    urgency: 0,
    spam: 0,
    coordination: 0,
    edge: 0,
    manual_matrix: 0,
  } satisfies Record<TrustThreatCategory, number>;

  for (const entry of cases) {
    byCategory[entry.category] += 1;
  }

  return {
    ok: cases.every((entry) => entry.passed),
    peerPublicKeyHex,
    cases,
    byCategory,
  };
};
