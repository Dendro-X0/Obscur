import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const BUNDLE_FIN_COLD = "BUNDLE_FIN_COLD";

describe("dm-kernel trust assessment contract (SEC-F)", () => {
  const pwaRoot = path.resolve(__dirname, "../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("port module stays recipient-local with no network imports", () => {
    const port = read("app/features/dm-kernel/dm-kernel-trust-assessment-port.ts");
    expect(port).toContain("assessDmTrustWarning");
    expect(port).toContain(BUNDLE_FIN_COLD);
    expect(port).not.toMatch(/fetch\s*\(/);
    expect(port).not.toMatch(/from\s+["']@dweb\/nostr/);
  });

  it("thread state uses profile-scoped local storage only", () => {
    const state = read("app/features/dm-kernel/dm-kernel-trust-thread-state.ts");
    expect(state).toContain("getScopedStorageKey");
    expect(state).toContain("localStorage");
    expect(state).not.toMatch(/fetch\s*\(/);
  });

  it("banner documents recipient-only assessment (sender silence invariant)", () => {
    const banner = read("app/features/dm-kernel/components/dm-kernel-trust-banner.tsx");
    expect(banner).toContain("recipientOnlyNote");
    expect(banner).toContain("data-testid=\"dm-kernel-trust-banner\"");
    expect(banner).toContain("dm-kernel-trust-info-strip");
    expect(banner).not.toContain("notifySender");
  });

  it("verify script entry exists in root package.json", () => {
    const pkg = readFileSync(path.join(pwaRoot, "..", "..", "package.json"), "utf8");
    expect(pkg).toContain("verify:trust-v1.9.5");
  });

  it("threat corpus fixture pack exists for adversary simulation", () => {
    const corpus = read("app/features/dm-kernel/dm-kernel-trust-threat-corpus.ts");
    expect(corpus).toContain("evaluateTrustThreatCorpus");
    expect(corpus).toContain("buildTrustThreatFixtureDefinitions");
    expect(corpus).toContain("phishing");
    expect(corpus).not.toMatch(/fetch\s*\(/);
  });

  it("port catalog includes SEC-F2 phish + SEC-B2 spam-shape + convergence signals", () => {
    const port = read("app/features/dm-kernel/dm-kernel-trust-assessment-port.ts");
    expect(port).toContain('"link.suspicious_url"');
    expect(port).toContain('"link.lookalike_brand"');
    expect(port).toContain('"attachment.risky_filename"');
    expect(port).toContain("detectLookalikeBrandLink");
    expect(port).toContain("detectRiskyAttachmentFilenames");
    expect(port).toContain("BUNDLE_PHISH_COLD");
    expect(port).toContain("BUNDLE_SE_COLD");
    expect(port).toContain("detectSuspiciousLink");
    expect(port).toContain("detectCredentialHarvestRequest");
    expect(port).toContain('"thread.financial_pressure"');
    expect(port).toContain('"thread.off_platform_redirect"');
    expect(port).toContain('"thread.advance_fee_scam"');
    expect(port).toContain('"thread.remote_access_tool"');
    expect(port).toContain('"thread.overpayment_refund"');
    expect(port).toContain('"thread.fake_escrow"');
    expect(port).toContain('"thread.hiring_trap"');
    expect(port).toContain("detectRemoteAccessTool");
    expect(port).toContain('"msg.rate"');
    expect(port).toContain('"invite.fanout"');
    expect(port).toContain('"connection.request_burst"');
    expect(port).toContain("BUNDLE_CONN_BURST");
    expect(port).toContain("BUNDLE_SPAM_COLD");
    expect(port).toContain("detectConnectionRequestBurstSignal");
    expect(port).toContain("contactTrustSensitivity");
    expect(port).toContain("resolveContactTrustSensitivityPolicy");
    expect(port).toContain("msgRateThreshold");
    expect(port).toContain("inviteFanoutThreshold");
  });

  it("peer spam metadata uses profile-scoped local storage only", () => {
    const peerState = read("app/features/dm-kernel/dm-kernel-trust-peer-state.ts");
    expect(peerState).toContain("getScopedStorageKey");
    expect(peerState).toContain("localStorage");
    expect(peerState).not.toMatch(/fetch\s*\(/);
  });
});
