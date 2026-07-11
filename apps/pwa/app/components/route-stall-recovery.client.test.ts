import { describe, expect, it, vi } from "vitest";

import * as routeStallRecovery from "./route-stall-recovery.client";
import {
  recoverFromRouteStall,
  shouldArmRouteStallWatchdog,
  shouldPreferSoftRouteStallRecovery,
} from "./route-stall-recovery.client";

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  getIdentitySnapshot: vi.fn(() => ({ status: "locked", stored: undefined })),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: vi.fn(() => false),
}));

describe("route-stall-recovery.client", () => {
  it("does not arm stall watchdog on native desktop", async () => {
    const runtime = await import("@/app/features/runtime/runtime-capabilities");
    vi.mocked(runtime.hasNativeRuntime).mockReturnValue(true);
    expect(shouldArmRouteStallWatchdog()).toBe(false);
    vi.mocked(runtime.hasNativeRuntime).mockReturnValue(false);
    expect(shouldArmRouteStallWatchdog()).toBe(true);
  });

  it("prefers soft route stall recovery for native sessions with stored identity", async () => {
    const identity = await import("@/app/features/auth/hooks/use-identity");
    const runtime = await import("@/app/features/runtime/runtime-capabilities");
    vi.mocked(runtime.hasNativeRuntime).mockReturnValue(true);
    vi.mocked(identity.getIdentitySnapshot).mockReturnValue({
      status: "unlocked",
      stored: { publicKeyHex: "a".repeat(64), encryptedPrivateKey: "encrypted-key" },
      publicKeyHex: "a".repeat(64),
      privateKeyHex: "b".repeat(64),
    });

    const push = vi.fn();
    const hardNavigateSpy = vi.spyOn(routeStallRecovery, "hardNavigate").mockImplementation(() => undefined);
    try {
      expect(shouldPreferSoftRouteStallRecovery()).toBe(true);
      recoverFromRouteStall("/settings", { push });
      expect(push).toHaveBeenCalledWith("/settings");
      expect(hardNavigateSpy).not.toHaveBeenCalled();
    } finally {
      hardNavigateSpy.mockRestore();
    }
  });

  it("does not prefer soft recovery without a native stored session", async () => {
    const identity = await import("@/app/features/auth/hooks/use-identity");
    const runtime = await import("@/app/features/runtime/runtime-capabilities");
    vi.mocked(runtime.hasNativeRuntime).mockReturnValue(false);
    vi.mocked(identity.getIdentitySnapshot).mockReturnValue({ status: "locked", stored: undefined });
    expect(shouldPreferSoftRouteStallRecovery()).toBe(false);
  });

  it("never hard-navigates on native desktop even when identity is locked", async () => {
    const identity = await import("@/app/features/auth/hooks/use-identity");
    const runtime = await import("@/app/features/runtime/runtime-capabilities");
    vi.mocked(runtime.hasNativeRuntime).mockReturnValue(true);
    vi.mocked(identity.getIdentitySnapshot).mockReturnValue({ status: "locked", stored: undefined });

    const push = vi.fn();
    const hardNavigateSpy = vi.spyOn(routeStallRecovery, "hardNavigate").mockImplementation(() => undefined);
    try {
      recoverFromRouteStall("/settings", { push });
      expect(push).toHaveBeenCalledWith("/settings");
      expect(hardNavigateSpy).not.toHaveBeenCalled();
    } finally {
      hardNavigateSpy.mockRestore();
    }
  });
});
