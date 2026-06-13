import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  identityStatus: "locked" as "locked" | "unlocked",
  storedPublicKeyHex: "a".repeat(64),
  retryResult: false,
  restoreAllowed: true,
  hasNative: true,
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => mocks.hasNative,
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "tester1",
}));

vi.mock("@/app/features/auth/services/device-session-consent", () => ({
  isDeviceSessionRestoreAllowed: () => mocks.restoreAllowed,
}));

vi.mock("@/app/features/runtime/services/window-runtime-binding", () => ({
  reconcileWindowRuntimeBinding: vi.fn(),
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  getIdentitySnapshot: () => ({
    status: mocks.identityStatus,
    stored: mocks.storedPublicKeyHex ? { publicKeyHex: mocks.storedPublicKeyHex } : undefined,
  }),
  useIdentityInternals: {
    retryNativeSessionUnlockAction: vi.fn(async () => mocks.retryResult),
  },
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

import { reconcileWindowRuntimeBinding } from "@/app/features/runtime/services/window-runtime-binding";
import { retryNativeSessionBootstrapAfterProfileReady } from "./native-session-bootstrap-retry";

describe("retryNativeSessionBootstrapAfterProfileReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.identityStatus = "locked";
    mocks.storedPublicKeyHex = "a".repeat(64);
    mocks.retryResult = false;
    mocks.restoreAllowed = true;
    mocks.hasNative = true;
  });

  it("returns false when restore is not allowed", async () => {
    mocks.restoreAllowed = false;
    await expect(retryNativeSessionBootstrapAfterProfileReady()).resolves.toBe(false);
  });

  it("reconciles runtime when deferred retry unlocks", async () => {
    mocks.retryResult = true;
    await expect(retryNativeSessionBootstrapAfterProfileReady()).resolves.toBe(true);
    expect(reconcileWindowRuntimeBinding).toHaveBeenCalledTimes(1);
  });
});
