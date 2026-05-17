import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetLocalHistoryKeepingIdentity } from "./local-history-reset-service";
import { readHistoryResetCutoffUnixMs } from "@/app/features/account-sync/services/history-reset-cutoff-store";

const PUBLIC_KEY = "a".repeat(64);

describe("local-history-reset-service", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("removes local history keys while preserving auth and retired-identity keys", async () => {
    window.localStorage.setItem(`dweb.nostr.pwa.chatState.v2.${PUBLIC_KEY}::default`, "{}");
    window.localStorage.setItem(`dweb.nostr.pwa.last-seen.${PUBLIC_KEY}::default`, "{}");
    window.localStorage.setItem("obscur.messaging.sync_checkpoints.v1::default", "{}");
    window.localStorage.setItem(`obscur.group.membership_ledger.v1.${PUBLIC_KEY}`, "[]");
    window.localStorage.setItem(`obscur.account_sync.recovery_snapshot.v1.${PUBLIC_KEY}`, "{}");
    window.localStorage.setItem("obscur-pending-voice-call-request", "{}");

    window.localStorage.setItem("obscur_remember_me::default", "true");
    window.localStorage.setItem("obscur_auth_token::default", "token-value");
    window.localStorage.setItem("obscur.retired_identity_registry.v1", "{\"entries\":[]}");

    const deps = {
      purgeLocalMediaCache: vi.fn(async () => {}),
      clearMessagingStores: vi.fn(async () => 3),
      clearLegacyMessageQueueStores: vi.fn(async () => 3),
      clearAccountEventLogStore: vi.fn(async () => 1),
      resetProjectionRuntime: vi.fn(() => {}),
      resetSyncStatusSnapshot: vi.fn((_publicKeyHex: string | null) => {}),
      resetBackupEventOrdering: vi.fn(() => {}),
    };

    const report = await resetLocalHistoryKeepingIdentity({
      profileId: "default",
      publicKeyHex: PUBLIC_KEY,
    }, deps);

    expect(window.localStorage.getItem(`dweb.nostr.pwa.chatState.v2.${PUBLIC_KEY}::default`)).toBeNull();
    expect(window.localStorage.getItem(`dweb.nostr.pwa.last-seen.${PUBLIC_KEY}::default`)).toBeNull();
    expect(window.localStorage.getItem("obscur.messaging.sync_checkpoints.v1::default")).toBeNull();
    expect(window.localStorage.getItem(`obscur.group.membership_ledger.v1.${PUBLIC_KEY}`)).toBeNull();
    expect(window.localStorage.getItem(`obscur.account_sync.recovery_snapshot.v1.${PUBLIC_KEY}`)).toBeNull();
    expect(window.localStorage.getItem("obscur-pending-voice-call-request")).toBeNull();

    expect(window.localStorage.getItem("obscur_remember_me::default")).toBe("true");
    expect(window.localStorage.getItem("obscur_auth_token::default")).toBe("token-value");
    expect(window.localStorage.getItem("obscur.retired_identity_registry.v1")).toBe("{\"entries\":[]}");

    expect(deps.purgeLocalMediaCache).toHaveBeenCalledTimes(1);
    expect(deps.clearMessagingStores).toHaveBeenCalledTimes(1);
    expect(deps.clearLegacyMessageQueueStores).toHaveBeenCalledTimes(1);
    expect(deps.clearAccountEventLogStore).toHaveBeenCalledTimes(1);
    expect(deps.resetProjectionRuntime).toHaveBeenCalledTimes(1);
    expect(deps.resetSyncStatusSnapshot).toHaveBeenCalledWith(PUBLIC_KEY);
    expect(deps.resetBackupEventOrdering).toHaveBeenCalledTimes(1);
    expect(readHistoryResetCutoffUnixMs("default")).not.toBeNull();

    expect(report.removedLocalStorageKeyCount).toBeGreaterThanOrEqual(6);
    expect(report.clearedIndexedDbStoreCount).toBe(7);
    expect(report.warnings).toHaveLength(0);
  });

  it("respects profile scope and does not remove unrelated profile keys", async () => {
    window.localStorage.setItem("obscur.messaging.sync_checkpoints.v1::default", "{}");
    window.localStorage.setItem("obscur.messaging.sync_checkpoints.v1::work", "{}");

    const deps = {
      purgeLocalMediaCache: vi.fn(async () => {}),
      clearMessagingStores: vi.fn(async () => 0),
      clearLegacyMessageQueueStores: vi.fn(async () => 0),
      clearAccountEventLogStore: vi.fn(async () => 0),
      resetProjectionRuntime: vi.fn(() => {}),
      resetSyncStatusSnapshot: vi.fn((_publicKeyHex: string | null) => {}),
      resetBackupEventOrdering: vi.fn(() => {}),
    };

    await resetLocalHistoryKeepingIdentity({ profileId: "default" }, deps);

    expect(window.localStorage.getItem("obscur.messaging.sync_checkpoints.v1::default")).toBeNull();
    expect(window.localStorage.getItem("obscur.messaging.sync_checkpoints.v1::work")).toBe("{}");
  });

  it("records warnings when best-effort cleanup dependencies fail", async () => {
    const deps = {
      purgeLocalMediaCache: vi.fn(async () => {
        throw new Error("media failed");
      }),
      clearMessagingStores: vi.fn(async () => {
        throw new Error("messaging failed");
      }),
      clearLegacyMessageQueueStores: vi.fn(async () => 0),
      clearAccountEventLogStore: vi.fn(async () => {
        throw new Error("event log failed");
      }),
      resetProjectionRuntime: vi.fn(() => {
        throw new Error("projection failed");
      }),
      resetSyncStatusSnapshot: vi.fn((_publicKeyHex: string | null) => {
        throw new Error("status failed");
      }),
      resetBackupEventOrdering: vi.fn(() => {
        throw new Error("ordering failed");
      }),
    };

    const report = await resetLocalHistoryKeepingIdentity({ profileId: "default" }, deps);
    expect(report.clearedIndexedDbStoreCount).toBe(0);
    expect(report.warnings.length).toBeGreaterThanOrEqual(5);
  });
});
