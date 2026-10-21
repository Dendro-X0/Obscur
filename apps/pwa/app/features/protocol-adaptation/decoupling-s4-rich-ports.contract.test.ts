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

  it("exports platform canonical ports from the public index", () => {
    for (const port of PLATFORM_CANONICAL_PORTS) {
      expect(index).toContain(port);
      expect(layer).toContain(`export const ${port} = ProtocolAdaptationLayer.${port}`);
    }
  });

  it("keeps Obscur-Nostr rich ports documented and exported for existing shell", () => {
    expect(layer).toContain("Obscur-Nostr rich");
    for (const port of OBSCUR_NOSTR_RICH_PORTS) {
      expect(index).toContain(port);
    }
  });

  it("keeps Nostr-private send on nostrAdapter for delete and retry", () => {
    expect(OBSCUR_NOSTR_PRIVATE_SEND).toBe("nostrAdapter.sendDm");
    expect(deletePipeline).toContain(OBSCUR_NOSTR_PRIVATE_SEND);
    expect(retry).toContain(OBSCUR_NOSTR_PRIVATE_SEND);
    expect(layer).toContain("nostrAdapter.sendDm");
  });

  it("re-exports nostrAdapter from the package index for Obscur-Nostr private callers", () => {
    expect(index).toContain('from "./nostr-adapter"');
    expect(index).toContain("nostrAdapter");
  });
});
