import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 13 Continuity M6 home backfill", () => {
  it("ships opaque home list helpers that drop plaintext", () => {
    const home = readText("packages/obscur-private-trust-engine/src/private-dc-home-client.ts");
    expect(home).toContain("listPrivateDcHomeConversations");
    expect(home).toContain("listPrivateDcHomeMessageEnvelopesDetailed");
    expect(home).toContain("droppedPlaintextCount");
  });

  it("wires M6 backfill ports + ContinuityDoor UI", () => {
    const ports = readText("apps/desktop-ui/src/continuity/ports.ts");
    const vite = readText("apps/desktop-ui/src/continuity/vite-continuity-ports.ts");
    const door = readText("apps/desktop-ui/src/continuity/ContinuityDoor.tsx");
    const backfill = readText("apps/desktop-ui/src/continuity/continuity-m6-backfill.ts");
    expect(ports).toContain("backfillFromPrivateHome");
    expect(ports).toContain("getLastHomeBackfillReport");
    expect(vite).toContain("runContinuityM6HomeBackfill");
    expect(door).toContain("continuity-m6-backfill-run");
    expect(backfill).toContain("opaque_envelopes_only");
    expect(backfill).not.toMatch(/relationship_edge|upsertRelationship/);
  });

  it("keeps Cut 13 design ≠ Continuity Pass and Soft L3 paused", () => {
    const spec = readText("specs/backend/cut13-continuity-m6-home-backfill-design-2026-11-10.md");
    expect(spec).toContain("≠ Continuity Pass");
    expect(spec).toMatch(/PAUSED \/ CANCELLED:.*Continuity Pass/);
    expect(spec).toContain("invent CRM");
  });
});
