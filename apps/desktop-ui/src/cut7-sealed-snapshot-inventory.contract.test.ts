import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SEALED_SNAPSHOT_CORE_FIELDS } from "./continuity/sealed-snapshot-inventory";

/**
 * Cut 7.2 — sealed snapshot inventory aligns with EncryptedAccountBackupPayload v1.
 * @see specs/backend/cut7-continuity-m1-sealed-file-design-2026-11-10.md
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 7.2 sealed snapshot inventory", () => {
  it("covers every EncryptedAccountBackupPayload v1 domain field", () => {
    const contracts = readText(
      "apps/pwa/app/features/account-sync/account-sync-contracts.ts",
    );
    for (const field of SEALED_SNAPSHOT_CORE_FIELDS) {
      expect(contracts).toContain(field);
    }
  });

  it("documents T0–T2 required + T3/T4 partial in Cut 7 design", () => {
    const spec = readText("specs/backend/cut7-continuity-m1-sealed-file-design-2026-11-10.md");
    expect(spec).toContain("7.2");
    expect(spec).toContain("T0–T2");
    expect(spec).toContain("T3");
    expect(spec).toContain("T4");
    expect(spec).toContain("≠ Continuity Pass");
  });

  it("keeps relationship graph in T1 inventory (peerTrust), not lookback-only", () => {
    const inventory = readText("apps/desktop-ui/src/continuity/sealed-snapshot-inventory.ts");
    expect(inventory).toContain('peerTrust: "T1"');
    expect(inventory).toContain('chatState: "T3"');
    expect(inventory).toContain("≠ Continuity Pass");
  });
});
