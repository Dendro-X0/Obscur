import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 10 — Continuity M4 device transfer contracts.
 * ≠ Continuity Pass · ≠ Soft L3 Fixed.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 10 Continuity M4 device transfer", () => {
  it("ships M4 offer create/verify with TTL + transfer code", () => {
    const offer = readText("apps/desktop-ui/src/continuity/continuity-m4-offer.ts");
    expect(offer).toContain("obscur.continuity_m4.offer.v1");
    expect(offer).toContain("createContinuityM4Offer");
    expect(offer).toContain("verifyContinuityM4Offer");
    expect(offer).toContain("expiresAtUnixMs");
    expect(offer).toContain("transferCode");
  });

  it("wires M4 ports on ContinuityPorts + vite adapter", () => {
    const ports = readText("apps/desktop-ui/src/continuity/ports.ts");
    const vite = readText("apps/desktop-ui/src/continuity/vite-continuity-ports.ts");
    expect(ports).toContain("createDeviceTransferOffer");
    expect(ports).toContain("acceptDeviceTransferOffer");
    expect(vite).toContain("createDeviceTransferOffer");
    expect(vite).toContain("acceptDeviceTransferOffer");
    expect(vite).toContain("createContinuityM4Offer");
  });

  it("ContinuityDoor exposes M4 create/accept UX", () => {
    const door = readText("apps/desktop-ui/src/continuity/ContinuityDoor.tsx");
    expect(door).toContain("continuity-m4-create-offer");
    expect(door).toContain("continuity-m4-accept");
    expect(door).toContain("M4 device transfer");
    expect(door).toContain("unlock does not restore");
  });

  it("keeps Cut 10 design ≠ Continuity Pass and Soft L3 paused", () => {
    const spec = readText("specs/backend/cut10-continuity-m4-device-transfer-design-2026-11-10.md");
    expect(spec).toContain("≠ Continuity Pass");
    expect(spec).toMatch(/PAUSED \/ CANCELLED:.*Continuity Pass/);
    expect(spec).toContain("Soft L3");
    expect(spec).toContain("LAN/WebRTC discovery deferred");
  });
});
