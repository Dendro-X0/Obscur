import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("E2EE boundary SEC-V1 contract (checklist §1)", () => {
  const pwaRoot = path.resolve(__dirname, "../../..");
  const repoRoot = path.resolve(pwaRoot, "..", "..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");
  const readRepo = (relativePath: string) => readFileSync(path.join(repoRoot, relativePath), "utf8");

  it("V1-1: DM send encrypts before relay wire (gift-wrap / NIP-44)", () => {
    const builder = read("app/features/messaging/controllers/dm-event-builder.ts");
    const pipeline = read("app/features/messaging/controllers/v2/dm-send-pipeline.ts");
    const publisher = read("app/features/messaging/controllers/outgoing-dm-publisher.ts");

    expect(builder).toContain("encryptGiftWrap");
    expect(builder).toContain("encryptDM");
    expect(pipeline).toContain("encryptGiftWrap");
    expect(publisher).toContain('JSON.stringify(["EVENT", signedEvent])');
    expect(publisher).toContain('JSON.stringify(["EVENT", params.message.signedEvent])');
    expect(publisher).not.toMatch(/JSON\.stringify\(\["EVENT",\s*params\.plaintext/);
  });

  it("V1-2: sealed group messages encrypt before publish", () => {
    const groupService = read("app/features/groups/services/group-service.ts");
    const chatActions = read("app/features/main-shell/hooks/use-chat-actions.ts");

    expect(groupService).toContain("encryptGroupMessage");
    expect(groupService).toMatch(/content:\s*JSON\.stringify\(encrypted\)/);
    expect(chatActions).toContain('JSON.stringify(["EVENT", params.event])');
    expect(chatActions).toContain("sendSealedMessage");
  });

  it("V1-3: messaging trust paths avoid third-party analytics upload hooks", () => {
    const logAppEvent = read("app/shared/log-app-event.ts");
    const verifyScript = readRepo("scripts/verify-e2ee-boundaries.mjs");

    expect(logAppEvent).not.toMatch(/fetch\s*\(/);
    expect(logAppEvent).not.toMatch(/navigator\.sendBeacon/);
    expect(verifyScript).toContain("ANALYTICS_FORBIDDEN_PATTERNS");
    expect(verifyScript).toContain("segment\\.(?:io|com)");
  });

  it("V1-4: trust assessments stay recipient-local (SEC-F port)", () => {
    const port = read("app/features/dm-kernel/dm-kernel-trust-assessment-port.ts");
    const banner = read("app/features/dm-kernel/components/dm-kernel-trust-banner.tsx");

    expect(port).toContain("assessDmTrustWarning");
    expect(port).not.toMatch(/fetch\s*\(/);
    expect(banner).toContain("recipientOnlyNote");
  });

  it("V1-5: anti-fraud peer state does not phone home scores", () => {
    const peerState = read("app/features/dm-kernel/dm-kernel-trust-peer-state.ts");
    const spamSignals = read("app/features/dm-kernel/dm-kernel-trust-spam-signals.ts");

    expect(peerState).toContain("localStorage");
    expect(peerState).not.toMatch(/fetch\s*\(/);
    expect(spamSignals).not.toMatch(/fetch\s*\(/);
    expect(spamSignals).not.toMatch(/XMLHttpRequest/);
  });

  it("verify:sec-v1-v1.9.5 runs grep script and SEC-V1 contracts", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:sec-v1-v1.9.5");
    expect(pkg).toMatch(/verify-e2ee-boundaries\.mjs/);
    expect(pkg).toMatch(/e2ee-boundary-sec-v1\.contract\.test\.ts/);
  });
});
