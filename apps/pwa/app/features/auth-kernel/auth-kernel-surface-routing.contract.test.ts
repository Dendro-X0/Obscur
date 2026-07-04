import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("AUTH-K-AUTH surface port routing", () => {
  const kernelDir = path.resolve(__dirname);
  const pwaAppRoot = path.resolve(kernelDir, "../../");

  it("routes auth-screen through useAuthKernelSurfaceActions", () => {
    const source = readFileSync(path.join(kernelDir, "hooks/use-auth-kernel-surface-actions.ts"), "utf8");
    expect(source).toContain("useAuthKernelPorts");
    expect(source).toContain("runAuthKernelBoundProfileCreate");
    expect(source).toContain("runAuthKernelBoundProfileImport");
    expect(source).toContain("runAuthKernelBoundProfileUnlockWithPassphrase");
    expect(source).toContain("runAuthKernelBoundProfileSignOut");
  });

  it("routes title-bar sign-out through runtime session port", () => {
    const titleBarSource = readFileSync(
      path.join(pwaAppRoot, "components/desktop/title-bar-profile-switcher.tsx"),
      "utf8",
    );
    expect(titleBarSource).toContain("useAuthKernelSurfaceActions");
    expect(titleBarSource).toContain("signOutBoundProfileWindow");
    expect(titleBarSource).not.toContain("runAuthKernelSignOutCleanup");
    expect(titleBarSource).not.toContain("endNativeDeviceSignInBestEffort");
  });

  it("routes auth-screen mutations through kernel surface actions", () => {
    const authScreenSource = readFileSync(
      path.join(pwaAppRoot, "features/auth/components/auth-screen.tsx"),
      "utf8",
    );
    expect(authScreenSource).toContain("useAuthKernelSurfaceActions");
    expect(authScreenSource).toContain("authKernel.createIdentityForBoundProfile");
    expect(authScreenSource).not.toContain("evaluateAuthKernelRegistrationGate");
    expect(authScreenSource).not.toContain("runtime.createIdentityForBoundProfile");
  });

  it("routes PWA avatar menu sign-out through kernel surface actions", () => {
    const avatarMenuSource = readFileSync(
      path.join(pwaAppRoot, "components/user-avatar-menu.tsx"),
      "utf8",
    );
    expect(avatarMenuSource).toContain("useAuthKernelSurfaceActions");
    expect(avatarMenuSource).toContain("signOutBoundProfileWindow");
    expect(avatarMenuSource).not.toContain("endNativeDeviceSignInBestEffort");
  });

  it("routes app lock through kernel runtime session port", () => {
    const lockActionSource = readFileSync(
      path.join(pwaAppRoot, "features/auth/hooks/use-app-lock-action.ts"),
      "utf8",
    );
    expect(lockActionSource).toContain("useAuthKernelSurfaceActions");
    expect(lockActionSource).toContain("lockBoundProfileWindow");
    expect(lockActionSource).not.toContain("lockAppSession");
  });
});
