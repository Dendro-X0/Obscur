import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPendingStartupAuthState } from "@/app/features/auth/services/startup-auth-state-contracts";

const supervisorMocks = vi.hoisted(() => ({
  syncIdentity: vi.fn(),
  bindProfile: vi.fn(),
  promoteUnlockedSession: vi.fn(),
}));

const identityMocks = vi.hoisted(() => ({
  getIdentityDiagnosticsSnapshot: vi.fn(),
  getIdentitySnapshot: vi.fn(() => ({ status: "locked" as const })),
  subscribeIdentityStore: vi.fn((_listener: () => void) => (): void => {}),
}));

const desktopMocks = vi.hoisted(() => ({
  getSnapshot: vi.fn(() => ({
    currentWindow: {
      windowLabel: "main",
      profileId: "default",
      profileLabel: "Default",
      launchMode: "existing" as const,
    },
    profiles: [],
    windowBindings: [],
  })),
  subscribe: vi.fn((_listener: () => void) => (): void => {}),
}));

vi.mock("@/app/features/runtime/services/window-runtime-supervisor", () => ({
  windowRuntimeSupervisor: supervisorMocks,
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  getIdentityDiagnosticsSnapshot: identityMocks.getIdentityDiagnosticsSnapshot,
  getIdentitySnapshot: identityMocks.getIdentitySnapshot,
  subscribeIdentityStore: identityMocks.subscribeIdentityStore,
}));

vi.mock("@/app/features/profiles/services/desktop-profile-runtime", () => ({
  desktopProfileRuntime: desktopMocks,
}));

import {
  reconcileWindowRuntimeBinding,
  startWindowRuntimeBinding,
} from "./window-runtime-binding";

describe("window-runtime-binding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identityMocks.getIdentityDiagnosticsSnapshot.mockReturnValue({
      status: "loading",
      startupState: createPendingStartupAuthState(),
    });
  });

  it("forwards identity diagnostics and desktop snapshot to the supervisor", () => {
    const startupState = createPendingStartupAuthState();
    identityMocks.getIdentityDiagnosticsSnapshot.mockReturnValue({
      status: "loading",
      startupState,
    });

    reconcileWindowRuntimeBinding();

    expect(supervisorMocks.promoteUnlockedSession).not.toHaveBeenCalled();
    expect(supervisorMocks.syncIdentity).toHaveBeenCalledWith({ startupState });
    expect(supervisorMocks.bindProfile).toHaveBeenCalledWith(desktopMocks.getSnapshot());
  });

  it("promotes runtime when identity is already unlocked", () => {
    identityMocks.getIdentitySnapshot.mockReturnValue({
      status: "unlocked",
      publicKeyHex: "abc",
    } as never);
    identityMocks.getIdentityDiagnosticsSnapshot.mockReturnValue({
      status: "unlocked",
      startupState: createPendingStartupAuthState(),
    });

    reconcileWindowRuntimeBinding();

    expect(supervisorMocks.promoteUnlockedSession).toHaveBeenCalledTimes(1);
  });

  it("subscribes once and reconciles on start", async () => {
    startWindowRuntimeBinding();

    expect(identityMocks.subscribeIdentityStore).toHaveBeenCalledTimes(1);
    expect(desktopMocks.subscribe).toHaveBeenCalledTimes(1);

    await vi.waitFor(() => {
      expect(supervisorMocks.bindProfile).toHaveBeenCalled();
    });
  });

  it("batches rapid store notifications into one reconcile", async () => {
    let identityListener: (() => void) | undefined;
    identityMocks.subscribeIdentityStore.mockImplementation((listener: () => void) => {
      identityListener = listener;
      return (): void => {};
    });

    startWindowRuntimeBinding();
    await vi.waitFor(() => {
      expect(supervisorMocks.bindProfile).toHaveBeenCalledTimes(1);
    });

    supervisorMocks.bindProfile.mockClear();
    identityListener?.();
    identityListener?.();
    identityListener?.();

    await vi.waitFor(() => {
      expect(supervisorMocks.bindProfile).toHaveBeenCalledTimes(1);
    });
  });
});
