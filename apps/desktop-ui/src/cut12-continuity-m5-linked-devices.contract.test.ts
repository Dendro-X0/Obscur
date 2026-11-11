import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 12 Continuity M5 linked devices", () => {
  it("ships linked-device registry enroll/revoke", () => {
    const registry = readText("apps/desktop-ui/src/continuity/continuity-linked-devices.ts");
    expect(registry).toContain("enrollContinuityLinkedDevice");
    expect(registry).toContain("revokeContinuityLinkedDevice");
    expect(registry).toContain("obscur.continuity.linked_devices.v1");
  });

  it("wires M5 ports + ContinuityDoor registry UI", () => {
    const ports = readText("apps/desktop-ui/src/continuity/ports.ts");
    const vite = readText("apps/desktop-ui/src/continuity/vite-continuity-ports.ts");
    const door = readText("apps/desktop-ui/src/continuity/ContinuityDoor.tsx");
    expect(ports).toContain("listLinkedDevices");
    expect(ports).toContain("enrollThisDevice");
    expect(ports).toContain("revokeLinkedDevice");
    expect(vite).toContain("enrollContinuityLinkedDevice");
    expect(door).toContain("continuity-m5-enroll");
    expect(door).toContain("registry ≠ live sync");
  });

  it("keeps Cut 12 design ≠ Continuity Pass and Soft L3 paused", () => {
    const spec = readText("specs/backend/cut12-continuity-m5-linked-devices-design-2026-11-10.md");
    expect(spec).toContain("≠ Continuity Pass");
    expect(spec).toMatch(/PAUSED \/ CANCELLED:.*Continuity Pass/);
    expect(spec).toContain("live delta sync");
  });
});
