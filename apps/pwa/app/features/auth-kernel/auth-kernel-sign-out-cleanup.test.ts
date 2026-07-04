import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAuthKernelSignOutCleanup } from "./auth-kernel-sign-out-cleanup";
import {
  isAuthKernelManualLockActive,
  markAuthKernelManualLock,
} from "./auth-kernel-manual-lock-state";

const deleteAssistantMock = vi.hoisted(() => vi.fn(async (_profileId: string) => undefined));

vi.mock("./services/auth-assistant-vault-service", () => ({
  deleteAuthAssistantVaultPayload: (profileId: string) => deleteAssistantMock(profileId),
}));

describe("auth-kernel sign-out cleanup", () => {
  beforeEach(() => {
    sessionStorage.clear();
    deleteAssistantMock.mockClear();
  });

  it("clears manual lock and assistant vault material", async () => {
    markAuthKernelManualLock("tester1");

    await runAuthKernelSignOutCleanup("tester1");

    expect(isAuthKernelManualLockActive("tester1")).toBe(false);
    expect(deleteAssistantMock).toHaveBeenCalledWith("tester1");
  });
});
