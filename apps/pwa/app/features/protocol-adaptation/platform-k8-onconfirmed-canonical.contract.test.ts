import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Platform rewrite band K8 — sendDm onConfirmed is Canonical-only.
 * @see specs/backend/platform-k8-onconfirmed-canonical-design-2026-11.md
 */
describe("platform K8 onConfirmed Canonical", () => {
  const featuresRoot = path.resolve(__dirname, "..");
  const pipeline = readFileSync(
    path.join(featuresRoot, "messaging/controllers/v2/dm-send-pipeline.ts"),
    "utf8",
  );
  const controller = readFileSync(
    path.join(featuresRoot, "messaging/controllers/v2/dm-controller.ts"),
    "utf8",
  );
  const layer = readFileSync(path.join(__dirname, "layer.ts"), "utf8");

  it("pipeline onConfirmed uses CanonicalSendConfirmation + mapper", () => {
    expect(pipeline).toContain("CanonicalSendConfirmation");
    expect(pipeline).toContain("toCanonicalSendConfirmation(confirmation)");
    expect(pipeline).toMatch(
      /onConfirmed\?:\s*\(confirmation:\s*CanonicalSendConfirmation\)\s*=>\s*void/,
    );
  });

  it("dm-controller handleConfirmed takes CanonicalSendConfirmation", () => {
    expect(controller).toContain("CanonicalSendConfirmation");
    expect(controller).toMatch(
      /handleConfirmed\s*=\s*\(confirmation:\s*CanonicalSendConfirmation\)/,
    );
    expect(controller).toContain("confirmation.successCount");
    expect(controller).not.toMatch(/confirmation\.relayResults\.map/);
  });

  it("layer private_dc/matrix shim emits Canonical counts", () => {
    expect(layer).toContain("successCount: 1");
    expect(layer).toContain("totalRelays: 1");
    expect(layer).not.toMatch(/onConfirmed\?\.\(\{\s*success:\s*true,\s*deliveryStatus:\s*"sent_quorum",\s*relayResults:/);
  });
});
