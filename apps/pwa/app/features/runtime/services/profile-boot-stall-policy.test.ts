import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => false,
}));

vi.mock("@/app/features/runtime/shell-contract", () => ({
  isDesktopShellBuild: () => false,
}));

import {
  PROFILE_BOOT_STALL_TIMEOUT_MS_DESKTOP,
  PROFILE_BOOT_STALL_TIMEOUT_MS_WEB,
  resolveProfileBootStallTimeoutMs,
} from "./profile-boot-stall-policy";

describe("profile-boot-stall-policy", () => {
  it("uses the web timeout when native desktop runtime is unavailable", () => {
    expect(resolveProfileBootStallTimeoutMs()).toBe(PROFILE_BOOT_STALL_TIMEOUT_MS_WEB);
  });

  it("reserves a longer desktop timeout budget than web", () => {
    expect(PROFILE_BOOT_STALL_TIMEOUT_MS_DESKTOP).toBeGreaterThan(PROFILE_BOOT_STALL_TIMEOUT_MS_WEB);
  });
});
