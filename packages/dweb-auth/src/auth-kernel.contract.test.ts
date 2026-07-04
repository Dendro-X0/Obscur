import { describe, expect, it } from "vitest";
import {
  AUTH_KERNEL_PACKAGE_VERSION,
  AUTH_KERNEL_PORT_IDS,
  DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY,
  authFailed,
  authOk,
  createDesktopShellPolicySnapshot,
  resolveStaySignedInFromOptions,
} from "./index";

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
