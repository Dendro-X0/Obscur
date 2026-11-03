import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P4g — private_dc rich list must not fall through to Nostr.
 * @see specs/backend/platform-p4g-private-dc-rich-list-shim-2026-11.md
 */
describe("platform P4g private_dc rich list shim", () => {
  const root = path.resolve(__dirname);
  const layer = readFileSync(path.join(root, "layer.ts"), "utf8");
  const adapter = readFileSync(path.join(root, "private-dc-adapter.ts"), "utf8");

  it("routes getRichListAdapter(private_dc) to privateDcAdapter", () => {
    expect(layer).toContain('if (protocolId === "private_dc")');
    expect(layer).toContain("return privateDcAdapter");
    expect(layer).not.toMatch(
      /private_dc uses canonical ports only[\s\S]*return nostrAdapter/,
    );
  });

  it("exposes listDmConversations and listDmMessages on privateDcAdapter", () => {
    expect(adapter).toContain("listDmConversations:");
    expect(adapter).toContain("listDmMessages:");
    expect(adapter).toContain("mapPrivateDcConversationToRich");
    expect(adapter).toContain("mapPrivateDcMessageToRich");
  });
});

