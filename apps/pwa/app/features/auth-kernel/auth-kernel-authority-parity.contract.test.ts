import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AUTH_KERNEL_PORT_IDS, DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY } from "@dweb/auth";
import {
  AUTH_KERNEL_LEGACY_BRIDGE_FILE,
  AUTH_KERNEL_LEGACY_SCATTER_FILES,
} from "./auth-kernel-subtraction-manifest";
import {
  AUTH_KERNEL_BAND,
  AUTH_KERNEL_KERN_GATES_COMPLETE,
  isAuthKernelAuthority,
} from "./auth-kernel-policy";
import { createAuthKernelPorts } from "./auth-kernel-ports";
import { runAuthKernelBootRestore } from "./auth-kernel-boot-owner";

describe("AUTH-K-AUTH-1 adapter parity gate", () => {
  it("requires KERN matrix complete before authority is enabled", () => {
    expect(AUTH_KERNEL_KERN_GATES_COMPLETE).toBe(true);
    expect(isAuthKernelAuthority()).toBe(AUTH_KERNEL_KERN_GATES_COMPLETE);
    expect(AUTH_KERNEL_BAND).toBe("AUTH-K-AUTHORITY");
  });

  it("exposes four port planes with runtime session boot owner", () => {
    expect(AUTH_KERNEL_PORT_IDS).toHaveLength(4);
    const ports = createAuthKernelPorts();
    expect(ports.identityRoot).toBeDefined();
    expect(ports.registrationPolicy).toBeDefined();
    expect(ports.deviceUnlock).toBeDefined();
    expect(ports.authAssistant).toBeDefined();
    expect(ports.runtimeSession).toBeDefined();
    expect(typeof runAuthKernelBootRestore).toBe("function");
  });

  it("aligns desktop restore product gate with @dweb/auth", () => {
    expect(DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY).toBe(true);
  });

  it("documents legacy bridge and scatter subtraction targets", () => {
    const repoRoot = path.resolve(__dirname, "../../../../../");
    const bridgeSource = readFileSync(
      path.join(repoRoot, "apps/pwa", AUTH_KERNEL_LEGACY_BRIDGE_FILE),
      "utf8",
    );
    expect(bridgeSource).toContain("authKernelIdentityActions");
    expect(bridgeSource).toContain("runAuthKernelUnlockWithPassphrase");
    expect(AUTH_KERNEL_LEGACY_SCATTER_FILES.length).toBeGreaterThanOrEqual(6);
  });
});
