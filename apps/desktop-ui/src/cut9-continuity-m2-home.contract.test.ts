import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 9.1–9.4 — Continuity M2 auto-DC contracts. ≠ Continuity Pass · ≠ Soft L3.
 * @see specs/backend/cut9-continuity-m2-auto-dc-design-2026-11-10.md
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 9 Continuity M2 auto-DC", () => {
  it("ships home Continuity backup client without plaintext path", () => {
    const client = readText("packages/obscur-private-trust-engine/src/private-dc-home-client.ts");
    expect(client).toContain("putPrivateDcContinuityBackup");
    expect(client).toContain("fetchLatestPrivateDcContinuityBackup");
    expect(client).toContain("/v1/continuity/backups");
    expect(client).toContain("sealedEnvelopeJson");
  });

  it("lab server exposes Continuity backup routes", () => {
    const lab = readText("scripts/lib/private-dc-lab-server.mjs");
    expect(lab).toContain("/v1/continuity/backups");
    expect(lab).toContain("continuityBackups");
    expect(lab).toContain("sealedEnvelopeJson");
  });

  it("vite Continuity ports publish/restore via home", () => {
    const ports = readText("apps/desktop-ui/src/continuity/vite-continuity-ports.ts");
    expect(ports).toContain("publishSealedSnapshotToHome");
    expect(ports).toContain("restoreSealedSnapshotFromHome");
    expect(ports).toContain("putPrivateDcContinuityBackup");
    expect(ports).not.toMatch(/from ["']@\/app\//);
  });

  it("ContinuityDoor exposes M2 home actions", () => {
    const door = readText("apps/desktop-ui/src/continuity/ContinuityDoor.tsx");
    expect(door).toContain("continuity-publish-home");
    expect(door).toContain("continuity-restore-home");
    expect(door).toContain("private home (M2)");
    expect(door).toContain("unlock does not restore");
  });

  it("keeps Cut 9 design ≠ Continuity Pass", () => {
    const spec = readText("specs/backend/cut9-continuity-m2-auto-dc-design-2026-11-10.md");
    expect(spec).toContain("≠ Continuity Pass");
    expect(spec).toMatch(/PAUSED \/ CANCELLED:.*Continuity Pass/);
    expect(spec).toContain("Dedicated /v1/continuity/backups");
  });
});
