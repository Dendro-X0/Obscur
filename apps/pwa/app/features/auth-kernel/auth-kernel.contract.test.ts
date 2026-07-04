import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTH_KERNEL_FORBIDDEN_KERNEL_IMPORTS,
  AUTH_KERNEL_IMPLEMENTATION_FILES,
  AUTH_KERNEL_LEGACY_SCATTER_FILES,
} from "./auth-kernel-subtraction-manifest";
import { AUTH_KERNEL_BAND, AUTH_KERNEL_KERN_GATES_COMPLETE, isAuthKernelAuthority } from "./auth-kernel-policy";
import {
  AUTH_KERNEL_PORT_IDS,
  DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY,
} from "@dweb/auth";

describe("auth-kernel policy", () => {
  it("is runtime authority after AUTH-K-AUTHORITY flip", () => {
    expect(isAuthKernelAuthority()).toBe(true);
    expect(AUTH_KERNEL_BAND).toBe("AUTH-K-AUTHORITY");
    expect(AUTH_KERNEL_KERN_GATES_COMPLETE).toBe(true);
  });

  it("aligns desktop restore gate with @dweb/auth package contract", () => {
    expect(DESKTOP_OS_SESSION_RESTORE_PRODUCT_READY).toBe(true);
  });

  it("documents four port planes", () => {
    expect(AUTH_KERNEL_PORT_IDS).toHaveLength(4);
  });
});

describe("auth-kernel quarantine", () => {
  const kernelDir = path.resolve(__dirname);

  it("kernel implementation files do not import legacy scatter modules", () => {
    const combined = AUTH_KERNEL_IMPLEMENTATION_FILES
      .map((file) => readFileSync(path.join(kernelDir, file), "utf8"))
      .join("\n");
    for (const token of AUTH_KERNEL_FORBIDDEN_KERNEL_IMPORTS) {
      expect(combined).not.toContain(token);
    }
  });

  it("manifest documents AUTH-K subtraction targets", () => {
    const charter = readFileSync(
      path.resolve(__dirname, "../../../../../docs/program/obscur-auth-kernel-charter-2026-06.md"),
      "utf8",
    );
    expect(charter).toContain("AUTH-K0");
    expect(charter).toContain("verify:auth-kernel-contracts");
    expect(AUTH_KERNEL_LEGACY_SCATTER_FILES.length).toBeGreaterThanOrEqual(6);
  });
});
