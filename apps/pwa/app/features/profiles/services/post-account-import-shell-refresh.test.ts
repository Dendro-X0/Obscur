import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/account-sync/services/account-projection-runtime", () => ({
  accountProjectionRuntime: {
    reset: vi.fn(),
    replay: vi.fn(async () => ({})),
  },
}));

vi.mock("@/app/features/messaging/services/messaging-chat-state-durability-port", () => ({
  messagingChatStateDurabilityPort: {
    flushAllPending: vi.fn(),
    purgeAllMemory: vi.fn(),
  },
}));

vi.mock("@/app/features/profile/hooks/use-profile", () => ({
  useProfileInternals: {
    loadFromStorage: vi.fn(() => ({ profile: { username: "Demouser" } })),
    setState: vi.fn(),
    notify: vi.fn(),
  },
}));

vi.mock("@/app/features/runtime/services/window-runtime-binding", () => ({
  reconcileWindowRuntimeBinding: vi.fn(),
}));

vi.mock("@/app/features/runtime/services/secondary-profile-dm-soft-refresh", () => ({
  runSecondaryProfileDmSoftRefresh: vi.fn(),
}));

vi.mock("@/app/features/runtime/services/secondary-profile-post-login-refresh-policy", () => ({
  isSecondaryProfileWindow: vi.fn(() => false),
}));

vi.mock("@/app/shared/account-sync-mutation-signal", () => ({
  emitAccountSyncMutation: vi.fn(),
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

import { accountProjectionRuntime } from "@/app/features/account-sync/services/account-projection-runtime";
import { messagingChatStateDurabilityPort } from "@/app/features/messaging/services/messaging-chat-state-durability-port";
import { useProfileInternals } from "@/app/features/profile/hooks/use-profile";
import { reconcileWindowRuntimeBinding } from "@/app/features/runtime/services/window-runtime-binding";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import { refreshShellAfterAccountImport } from "./post-account-import-shell-refresh";

const PK = "87cb2c20012587cb2c20012587cb2c20012587cb2c20012587cb2c20012587cb2c20" as never;

describe("refreshShellAfterAccountImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("purges stale memory, replays projection, and emits sync mutations without reloading", async () => {
    await refreshShellAfterAccountImport({
      profileId: "default",
      publicKeyHex: PK,
    });

    expect(messagingChatStateDurabilityPort.flushAllPending).toHaveBeenCalled();
    expect(messagingChatStateDurabilityPort.purgeAllMemory).toHaveBeenCalled();
    expect(useProfileInternals.loadFromStorage).toHaveBeenCalled();
    expect(accountProjectionRuntime.reset).toHaveBeenCalled();
    expect(accountProjectionRuntime.replay).toHaveBeenCalledWith({
      profileId: "default",
      accountPublicKeyHex: PK,
    });
    expect(emitAccountSyncMutation).toHaveBeenCalledWith("identity_unlock_changed", { profileId: "default" });
    expect(reconcileWindowRuntimeBinding).toHaveBeenCalled();
  });
});
