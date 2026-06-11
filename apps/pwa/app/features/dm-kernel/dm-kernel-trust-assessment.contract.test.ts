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
    expect(banner).not.toContain("notifySender");
  });

  it("verify script entry exists in root package.json", () => {
    const pkg = readFileSync(path.join(pwaRoot, "..", "..", "package.json"), "utf8");
    expect(pkg).toContain("verify:trust-v1.9.5");
  });

  it("port catalog includes SEC-B2 spam-shape signals", () => {
    const port = read("app/features/dm-kernel/dm-kernel-trust-assessment-port.ts");
    expect(port).toContain('"msg.rate"');
    expect(port).toContain('"invite.fanout"');
    expect(port).toContain("BUNDLE_SPAM_COLD");
    expect(port).toContain("detectMsgRateSignal");
    expect(port).toContain("detectInviteFanoutSignal");
  });

  it("peer spam metadata uses profile-scoped local storage only", () => {
    const peerState = read("app/features/dm-kernel/dm-kernel-trust-peer-state.ts");
    expect(peerState).toContain("getScopedStorageKey");
    expect(peerState).toContain("localStorage");
    expect(peerState).not.toMatch(/fetch\s*\(/);
  });
});
