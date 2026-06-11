import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatRelayPublishPartialCoverageMessage,
  getRelayPublishFailureUserMessage,
} from "./relay-publish-user-copy";

describe("relay publish honesty SEC-R4 contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const repoRoot = path.resolve(pwaRoot, "..", "..");

  it("partial quorum user copy matches attack-shaped chaos outcomes (1/3)", () => {
    const partialMessage = formatRelayPublishPartialCoverageMessage(1, 3);
    const failureMessage = getRelayPublishFailureUserMessage({
      reasonCode: "quorum_not_met",
      successCount: 1,
      totalRelays: 3,
    });
    expect(partialMessage).toMatch(/partial \(1\/3\)/i);
    expect(failureMessage).toMatch(/partial \(1\/3\)/i);
    expect(failureMessage).toMatch(/may not reach everyone/i);
  });

  it("degraded relay churn copy stays honest (no false success)", () => {
    const message = getRelayPublishFailureUserMessage({ reasonCode: "relay_degraded" });
    expect(message).toMatch(/degraded/i);
    expect(message).toMatch(/could not be confirmed/i);
    expect(message).not.toMatch(/delivered successfully/i);
  });

  it("relay-publish-chaos.test.ts covers intermittent failure under load", () => {
    const chaos = readFileSync(
      path.join(pwaRoot, "app/features/relays/lib/relay-publish-chaos.test.ts"),
      "utf8",
    );
    expect(chaos).toContain("503 Service Unavailable");
    expect(chaos).toContain("quorum_not_met");
    expect(chaos).toContain("partial");
  });

  it("verify:relay-v1.9.5 includes SEC-R4 publish honesty tests", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:relay-v1.9.5");
    expect(pkg).toMatch(/relay-publish-user-copy\.test\.ts/);
    expect(pkg).toMatch(/relay-publish-chaos\.test\.ts/);
    expect(pkg).toMatch(/relay-publish-sec-r4\.contract\.test\.ts/);
  });
});
