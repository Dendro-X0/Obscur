import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Path B Band B5 exit contract — safety/warnings, M10 shared intel, anti-bot/rate hooks.
 */
describe("path B B5 exit contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const repoRoot = path.resolve(pwaRoot, "..", "..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("B5 hook registry delegates safety, M10, and invite economics without new chat-state paths", () => {
    const hooks = read("app/features/messaging/services/path-b-b5-extension-hooks.ts");
    expect(hooks).toContain("shouldShowPathBThreadWarningBanner");
    expect(hooks).toContain("evaluatePathBIncomingDmSafetyGate");
    expect(hooks).toContain("evaluatePathBM10StrictModeGate");
    expect(hooks).toContain("evaluatePathBConnectionRequestEconomicsGate");
    expect(hooks).toContain("evaluateIncomingRequestAntiAbuse");
    expect(hooks).toContain("canSendConnectionRequest");
    expect(hooks).toContain("evaluateIncomingRequestAttackModeGate");
    expect(hooks).not.toContain("chatStateStoreService");
  });

  it("B5-1: thread chrome uses recipient-only StrangerWarningBanner gate", () => {
    const chatView = read("app/features/messaging/components/chat-view.tsx");
    expect(chatView).toContain("StrangerWarningBanner");
    expect(chatView).toContain("shouldShowPathBThreadWarningBanner");
    expect(chatView).not.toMatch(/conversation\.kind === ['"]dm['"] && props\.isPeerAccepted === false/);
  });

  it("B5-2: DM receive pipeline routes incoming requests through Path B safety gate", () => {
    const handler = read("app/features/messaging/controllers/legacy/incoming-dm-event-handler.ts");
    expect(handler).toContain("evaluatePathBIncomingDmSafetyGate");
    expect(handler).not.toContain("evaluateIncomingRequestAntiAbuse({");
  });

  it("B5-3: request transport send path checks invite economics before publish", () => {
    const transport = read("app/features/messaging/services/request-transport-service.ts");
    expect(transport).toContain("evaluatePathBConnectionRequestEconomicsGate");
    expect(transport).toMatch(/sendRequest[\s\S]*evaluatePathBConnectionRequestEconomicsGate/);
  });

  it("M10 shared intel policy remains the strict-mode owner", () => {
    const m10 = read("app/features/messaging/services/m10-shared-intel-policy.ts");
    const antiAbuse = read("app/features/messaging/services/incoming-request-anti-abuse.ts");
    expect(m10).toContain("evaluateIncomingRequestAttackModeGate");
    expect(m10).toContain("evaluateSignedSharedIntelRelayRisk");
    expect(antiAbuse).toContain("evaluateIncomingRequestAttackModeGate");
    expect(antiAbuse).toContain("evaluateSignedSharedIntelRelayRisk");
  });

  it("verify path-b-b5 and p5-safety scripts exist", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:path-b-b5");
    expect(pkg).toContain("verify:p5-safety");
  });
});
