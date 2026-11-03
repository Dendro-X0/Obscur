import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MATRIX_LAB_CAPABILITIES } from "./matrix-capabilities";
import { mapMatrixRoomToRichConversation } from "./matrix-rich-map";

/**
 * C3 — Matrix lab capabilities + rich map (not promote).
 * @see specs/backend/platform-c3-matrix-capabilities-rich-map-2026-11.md
 */
describe("platform C3 Matrix capabilities + rich map", () => {
  const repoRoot = path.resolve(__dirname, "../../../../../");
  const adapterSource = readFileSync(
    path.join(repoRoot, "apps/pwa/app/features/protocol-adaptation/matrix-adapter.ts"),
    "utf8",
  );
  const design = readFileSync(
    path.join(repoRoot, "specs/backend/platform-c3-matrix-capabilities-rich-map-2026-11.md"),
    "utf8",
  );

  it("exports lab capabilities and room map", () => {
    expect(MATRIX_LAB_CAPABILITIES.groups).toBe(true);
    expect(MATRIX_LAB_CAPABILITIES.media).toBe(false);
    expect(mapMatrixRoomToRichConversation({
      roomId: "!r:hs",
      title: "R",
      lastMessagePreview: "",
      lastMessageAtUnixMs: 0,
    }).pubkey).toBe("!r:hs");
  });

  it("adapter uses leaves and design forbids promote claim", () => {
    expect(adapterSource).toContain("MATRIX_LAB_CAPABILITIES");
    expect(adapterSource).toContain("mapMatrixRoomToRichConversation");
    expect(adapterSource).toContain("mapMatrixTimelineToRichMessage");
    expect(adapterSource).toContain("mapMatrixTimelineToCanonical");
    expect(adapterSource).not.toMatch(/const roomToDmConversation\s*=/);
    expect(adapterSource).not.toMatch(/const timelineToMessage\s*=/);
    expect(design).toMatch(/not Matrix promote/i);
  });
});
