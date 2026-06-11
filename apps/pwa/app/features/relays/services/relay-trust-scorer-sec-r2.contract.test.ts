import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("relay trust scorer SEC-R2 contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("relay-trust-scorer exports pure scoring helpers for tests and add flow", () => {
    const scorer = read("app/features/security/services/relay-trust-scorer.ts");
    expect(scorer).toContain("export const calculateRelayHealthScore");
    expect(scorer).toContain("export const determineRelayTrustLevel");
    expect(scorer).toContain("export const buildRelayScoreFromMetrics");
    expect(scorer).toContain("return buildRelayScoreFromMetrics(metrics)");
  });

  it("relay add assessment unifies URL validation, capability tier, and behavioral score", () => {
    const assessment = read("app/features/relays/services/relay-add-trust-assessment.ts");
    expect(assessment).toContain("assessRelayAddTrust");
    expect(assessment).toContain("validateRelayUrl");
    expect(assessment).toContain("assessRelayCapability");
    expect(assessment).toContain("buildRelayScoreFromMetrics");
    expect(assessment).toContain("public_default_notice");
  });

  it("Settings → Relays add handler uses assessRelayAddTrust", () => {
    const settingsModel = read("app/settings/settings-tab-panel-models/use-relays-settings-model.ts");
    expect(settingsModel).toContain("assessRelayAddTrust");
    expect(settingsModel).toContain("showWorkspaceNotice");
  });

  it("verify:relay-v1.9.5 includes SEC-R2 scorer and add-path tests", () => {
    const pkg = readFileSync(path.join(pwaRoot, "..", "..", "package.json"), "utf8");
    expect(pkg).toContain("verify:relay-v1.9.5");
    expect(pkg).toMatch(/relay-trust-scorer\.test\.ts/);
    expect(pkg).toMatch(/relay-add-trust-assessment\.test\.ts/);
    expect(pkg).toMatch(/relay-trust-scorer-sec-r2\.contract\.test\.ts/);
  });
});
