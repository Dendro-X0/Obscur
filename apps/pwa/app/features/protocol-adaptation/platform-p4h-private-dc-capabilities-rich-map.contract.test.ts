import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRIVATE_DC_CAPABILITIES } from "./private-dc-capabilities";
import { mapPrivateDcConversationToRich } from "./private-dc-rich-map";

/**
 * P4h — private_dc capabilities + rich map leaves.
 * @see specs/backend/platform-p4h-private-dc-capabilities-rich-map-2026-11.md
 */
describe("platform P4h private_dc capabilities + rich map", () => {
  const repoRoot = path.resolve(__dirname, "../../../../../");
  const adapterSource = readFileSync(
    path.join(repoRoot, "apps/pwa/app/features/protocol-adaptation/private-dc-adapter.ts"),
    "utf8",
  );

  it("exports DM-only capabilities", () => {
    expect(PRIVATE_DC_CAPABILITIES.dms).toBe(true);
    expect(PRIVATE_DC_CAPABILITIES.groups).toBe(false);
    expect(mapPrivateDcConversationToRich({ id: "c", title: "T" }).pubkey).toBe("c");
  });

  it("adapter uses capabilities and rich-map leaves", () => {
    expect(adapterSource).toContain("PRIVATE_DC_CAPABILITIES");
    expect(adapterSource).toContain("mapPrivateDcConversationToRich");
    expect(adapterSource).toContain("mapPrivateDcMessageToRich");
    expect(adapterSource).not.toMatch(/const toDmConversation\s*=/);
    expect(adapterSource).not.toMatch(/const toRichMessage\s*=/);
    expect(adapterSource).not.toMatch(/capabilities:\s*\(\)\s*=>\s*\(\{[\s\S]*dms:\s*true/);
  });
});
