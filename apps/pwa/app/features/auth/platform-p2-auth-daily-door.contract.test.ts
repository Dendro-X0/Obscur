import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTH_DAILY_DOOR_ADVANCED,
  AUTH_DAILY_DOOR_PRIMARY,
  AUTH_DAILY_DOOR_RULES,
} from "./services/auth-daily-door-p2-fence";

/**
 * Platform rewrite band P2 L1 — daily door = passphrase; key = Advanced.
 * Does not mint L3 Fixed.
 */
describe("platform P2 auth daily door fence", () => {
  const authScreen = path.resolve(__dirname, "components/auth-screen.tsx");

  it("documents daily vs Advanced door rules", () => {
    expect(AUTH_DAILY_DOOR_PRIMARY).toBe("passphrase_or_device_password");
    expect(AUTH_DAILY_DOOR_ADVANCED).toBe("private_key_import_or_unlock");
    expect(AUTH_DAILY_DOOR_RULES).toContain("private_key_ui_behind_advanced_toggle");
    expect(AUTH_DAILY_DOOR_RULES).toContain("l3_desktop_soak_before_auth_plane_freeze_claim");
  });

  it("keeps auth-screen private key behind Advanced toggle with passphrase primary", () => {
    const source = readFileSync(authScreen, "utf8");
    expect(source).toContain("showAdvancedKeyUnlock");
    expect(source).toContain("hideAdvancedPrivateKey");
    expect(source).toMatch(/passphrase-primary|passphrase primary/i);
    expect(source).toContain("useAuthKernelSurfaceActions");
    // OAuth-as-root remains forbidden (rewrite band).
    expect(source).not.toMatch(/oauth|OAuth/);
  });
});
