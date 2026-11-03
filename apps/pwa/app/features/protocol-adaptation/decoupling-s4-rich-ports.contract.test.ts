import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  OBSCUR_NOSTR_PRIVATE_SEND,
  OBSCUR_NOSTR_RICH_PORTS,
  PLATFORM_CANONICAL_PORTS,
} from "./port-surfaces";

/**
 * Slice S4 — rich ports are Obscur-Nostr compatibility; canonical is the platform surface.
 * Does not migrate MessagingProvider onto CanonicalMessage.
 */
describe("decoupling S4 rich port narrowing", () => {
  const layer = readFileSync(path.join(__dirname, "layer.ts"), "utf8");
  const index = readFileSync(path.join(__dirname, "index.ts"), "utf8");
  const deletePipeline = readFileSync(
    path.join(__dirname, "../messaging/controllers/v2/dm-delete-pipeline.ts"),
    "utf8",
  );
  const retry = readFileSync(
    path.join(__dirname, "../messaging/controllers/v2/dm-send-with-retry.ts"),
    "utf8",
  );

  it("exports platform canonical ports from the layer leaf (index stays types-only)", () => {
    expect(index).toContain('from "./types"');
    for (const port of PLATFORM_CANONICAL_PORTS) {
      expect(layer).toContain(`export const ${port} = ProtocolAdaptationLayer.${port}`);
    }
  });

  it("keeps Obscur-Nostr rich ports documented and exported from the layer leaf", () => {
    expect(layer).toContain("Obscur-Nostr rich");
    for (const port of OBSCUR_NOSTR_RICH_PORTS) {
      expect(layer).toContain(`export const ${port} = ProtocolAdaptationLayer.${port}`);
    }
  });

  it("routes delete and retry through layer sendDmNostrOnly (K1); adapter remains private impl", () => {
    expect(OBSCUR_NOSTR_PRIVATE_SEND).toBe("nostrAdapter.sendDm");
    expect(deletePipeline).toContain("sendDmNostrOnly");
    expect(retry).toContain("sendDmNostrOnly");
    expect(deletePipeline).not.toContain("nostrAdapter");
    expect(retry).not.toContain("nostrAdapter");
    expect(layer).toContain("sendDmNostrOnly");
    expect(layer).toContain(OBSCUR_NOSTR_PRIVATE_SEND);
  });

  it("keeps nostrAdapter on the nostr-adapter leaf (not the thin public index)", () => {
    const shim = readFileSync(path.join(__dirname, "nostr-adapter.ts"), "utf8");
    expect(shim).toContain("nostrAdapter");
    expect(index).not.toContain("nostrAdapter");
  });
});
