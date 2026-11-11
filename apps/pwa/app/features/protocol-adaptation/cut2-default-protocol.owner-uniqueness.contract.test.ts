import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("Cut 2.1 K-DEFAULT-NOSTR owner-uniqueness", () => {
  it("preferences resolve via shared evidence helper (native + H-dc → private_dc)", () => {
    const source = read("app/features/protocol-adaptation/preferences.ts");
    expect(source).toContain("resolveActiveProtocolId");
    expect(source).toContain("readStoredActiveProtocolId");
    expect(source).toContain("hasPrivateDcSession");
    expect(source).toContain("requiresSqlitePersistence");
    expect(source).toContain("resolveActiveProtocolIdFromEvidence");
    expect(source).toMatch(
      /preferPrivateDcWhenNoStored:\s*requiresSqlitePersistence\(\)\s*&&\s*hasPrivateDcSession/,
    );
    expect(source).toMatch(
      /readActiveProtocolId[\s\S]*?resolveActiveProtocolId/,
    );
  });

  it("layer still reads active protocol via preferences (no parallel default)", () => {
    const layer = read("app/features/protocol-adaptation/layer.ts");
    expect(layer).toContain("readActiveProtocolId");
    expect(layer).not.toMatch(/return "nostr"[\s\S]*getActiveProtocolId/);
  });
});
