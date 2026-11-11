import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 8.2 — vite Continuity ports. ≠ Continuity Pass.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 8.2 vite Continuity ports", () => {
  it("implements createViteContinuityPorts without pwa mega-import", () => {
    const ports = readText("apps/desktop-ui/src/continuity/vite-continuity-ports.ts");
    expect(ports).toContain("createViteContinuityPorts");
    expect(ports).toContain("sealContinuityM1Snapshot");
    expect(ports).not.toMatch(/chatState|chat-state/i);
    expect(ports).not.toMatch(/encrypted-account-backup-service/);
    expect(ports).not.toMatch(/from ["']@\/app\//);
  });

  it("duplicates peer-trust key prefix instead of importing pwa", () => {
    const ports = readText("apps/desktop-ui/src/continuity/vite-continuity-ports.ts");
    expect(ports).toContain("obscur.peer_trust.v1");
  });
});
