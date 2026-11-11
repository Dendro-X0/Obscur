import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 11 — Vite product-depth contracts.
 * ≠ Continuity Pass · ≠ Soft L3 Fixed.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

const readText = (relativePath: string): string => (
  readFileSync(join(REPO_ROOT, relativePath), "utf8")
);

describe("Cut 11 Vite product-depth", () => {
  it("ships createVitePassphraseIdentity + writeViteIdentityRecord", () => {
    const unlock = readText("apps/desktop-ui/src/auth/vite-passphrase-device-unlock.ts");
    expect(unlock).toContain("createVitePassphraseIdentity");
    expect(unlock).toContain("writeViteIdentityRecord");
    expect(unlock).toContain("encryptPrivateKeyHex");
  });

  it("AuthDoor supports create account + product honesty", () => {
    const door = readText("apps/desktop-ui/src/auth/AuthDoor.tsx");
    const honesty = readText("apps/desktop-ui/src/remaster-honesty-copy.ts");
    expect(door).toContain("auth-door-create");
    expect(door).toContain("createVitePassphraseIdentity");
    expect(door).toContain("REMASTER_AUTH_META");
    expect(honesty).toContain("unlock ≠ Continuity");
    expect(honesty).toContain("Soft L3 paused");
    expect(door).not.toContain("Vite lab auth door");
  });

  it("ships PrivateHomeSessionDoor + writeVitePrivateDcSession", () => {
    const home = readText("apps/desktop-ui/src/private-trust/PrivateHomeSessionDoor.tsx");
    const session = readText("apps/desktop-ui/src/private-trust/vite-private-dc-session.ts");
    const shell = readText("apps/desktop-ui/src/private-trust/PrivateTrustHome.tsx");
    const honesty = readText("apps/desktop-ui/src/remaster-honesty-copy.ts");
    expect(home).toContain("private-home-session-door");
    expect(session).toContain("writeVitePrivateDcSession");
    expect(shell).toContain("PrivateHomeSessionDoor");
    expect(shell).toContain("REMASTER_SHELL_HONESTY");
    expect(honesty).toContain("Continuity Pass not claimed");
  });

  it("keeps Cut 11 design ≠ Continuity Pass", () => {
    const spec = readText("specs/backend/cut11-vite-product-depth-design-2026-11-10.md");
    expect(spec).toContain("≠ Continuity Pass");
    expect(spec).toMatch(/PAUSED \/ CANCELLED:.*Continuity Pass/);
    expect(spec).toContain("Create account");
  });
});
