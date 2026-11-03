import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  toCanonicalSendConfirmation,
  type CanonicalSendConfirmation,
  type SendConfirmation,
} from "./send-confirmation";

/**
 * Platform rewrite band K7 — slim CanonicalSendConfirmation on PAL.
 * @see specs/backend/platform-k7-canonical-send-confirmation-design-2026-11.md
 */
describe("platform K7 CanonicalSendConfirmation", () => {
  const protocolRoot = path.resolve(__dirname);

  it("defines a slim DTO without relayResults", () => {
    const source = readFileSync(path.join(protocolRoot, "send-confirmation.ts"), "utf8");
    expect(source).toContain("export type CanonicalSendConfirmation");
    expect(source).toContain("toCanonicalSendConfirmation");
    // The Canonical type block must not declare relayResults.
    const match = source.match(
      /export type CanonicalSendConfirmation = Readonly<\{([\s\S]*?)\}>;/,
    );
    expect(match?.[1] ?? "").not.toMatch(/relayResults/);
  });

  it("layer exports Canonical + mapper beside rich SendConfirmation", () => {
    const layer = readFileSync(path.join(protocolRoot, "layer.ts"), "utf8");
    expect(layer).toContain("CanonicalSendConfirmation");
    expect(layer).toContain("toCanonicalSendConfirmation");
    expect(layer).toContain("SendConfirmation");
  });

  it("mapper output is assignable to CanonicalSendConfirmation", () => {
    const rich: SendConfirmation = {
      success: true,
      deliveryStatus: "sent_quorum",
      relayResults: [{ relayUrl: "wss://x", success: true }],
    };
    const canonical: CanonicalSendConfirmation = toCanonicalSendConfirmation(rich);
    expect(canonical.successCount).toBe(1);
    expect(canonical.totalRelays).toBe(1);
  });
});
