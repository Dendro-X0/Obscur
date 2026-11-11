import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 15 Continuity peer history grants", () => {
  it("ships grant create/verify/accept without CRM invent", () => {
    const grant = readText("apps/desktop-ui/src/continuity/continuity-peer-history-grant.ts");
    expect(grant).toContain("createContinuityPeerHistoryGrantOffer");
    expect(grant).toContain("acceptContinuityPeerHistoryGrant");
    expect(grant).toContain("opaque_history_grant");
    expect(grant).not.toContain("upsertRelationship");
    expect(grant).not.toContain("from \"./private-trust-crm\"");
    expect(grant).not.toContain("from \"@obscur/private-trust-engine\"");
  });

  it("wires ports + ContinuityDoor peer grant UI", () => {
    const ports = readText("apps/desktop-ui/src/continuity/ports.ts");
    const vite = readText("apps/desktop-ui/src/continuity/vite-continuity-ports.ts");
    const door = readText("apps/desktop-ui/src/continuity/ContinuityDoor.tsx");
    expect(ports).toContain("createPeerHistoryGrant");
    expect(ports).toContain("acceptPeerHistoryGrant");
    expect(ports).toContain("listPeerHistoryGrants");
    expect(vite).toContain("createContinuityPeerHistoryGrantOffer");
    expect(door).toContain("continuity-peer-grant-create");
    expect(door).toContain("≠ invent CRM");
  });

  it("keeps Cut 15 design ≠ Continuity Pass and Soft L3 paused", () => {
    const spec = readText("specs/backend/cut15-continuity-peer-history-grants-design-2026-11-10.md");
    expect(spec).toContain("≠ Continuity Pass");
    expect(spec).toMatch(/PAUSED \/ CANCELLED:.*Continuity Pass/);
    expect(spec).toContain("invent CRM");
  });
});
