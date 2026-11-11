import { describe, expect, it } from "vitest";
import { AUTH_KERNEL_PACKAGE_VERSION, AUTH_KERNEL_PORT_IDS } from "./index";
import { authFailed, authOk } from "./contracts/auth-result";
import { resolveStaySignedInFromOptions } from "./contracts/auth-unlock-options";
import {
  DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY,
  createDesktopShellPolicySnapshot,
} from "./policy/session-credential-policy-contract";
import { resolveAuthShellReady } from "./policy/auth-shell-ready-gate";

describe("@dweb/auth package contracts", () => {
  it("exports four auth kernel port ids", () => {
    expect(AUTH_KERNEL_PORT_IDS).toEqual([
      "obscur.auth.identity-root",
      "obscur.auth.registration-policy",
      "obscur.auth.device-unlock",
      "obscur.auth.runtime-session",
    ]);
    expect(AUTH_KERNEL_PACKAGE_VERSION).toBe("auth-k0");
  });

  it("enables desktop OS restore after AUTH-KERN-1", () => {
    expect(DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY).toBe(true);
    const policy = createDesktopShellPolicySnapshot();
    expect(policy.nativeSecureSessionRestoreEnabled).toBe(true);
    expect(policy.credentialPersistenceEnabled).toBe(false);
  });

  it("models auth results without throwing", () => {
    expect(authOk({ profileId: "tester1" }).status).toBe("ok");
    expect(authFailed({ reasonCode: "keychain_missing" }).status).toBe("failed");
  });

  it("exports AuthGateway-equivalent shell-ready gate", () => {
    const hex = "c".repeat(64);
    expect(resolveAuthShellReady({
      identityStatus: "unlocked",
      publicKeyHex: hex,
      devicePasswordBindPending: true,
    })).toBe(false);
    expect(resolveAuthShellReady({
      identityStatus: "unlocked",
      publicKeyHex: hex,
      devicePasswordBindPending: false,
    })).toBe(true);
  });

  it("defaults stay signed in unless explicitly opted out", () => {
    expect(resolveStaySignedInFromOptions({
      profileId: "default",
      context: "unlock",
    })).toBe(true);
    expect(resolveStaySignedInFromOptions({
      profileId: "default",
      context: "unlock",
      staySignedIn: false,
    })).toBe(false);
  });
});
