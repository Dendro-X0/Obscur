import { beforeEach, describe, expect, it, vi } from "vitest";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import {
  COORDINATION_OVERRIDE_KEY,
  WORKSPACE_RELAY_KEY,
} from "@/app/features/groups/services/operator-trust-config";
import {
  clearProfileLocalCachesKeepingIdentity,
  completeProfileLocalDataRemoval,
} from "./profile-local-reset-service";

const PUBLIC_KEY = "a".repeat(64);

vi.mock("@dweb/db", () => ({
  dbWipeProfileLocalData: vi.fn(async (profileId: string, removeProfileRow: boolean) => ({
    profile_id: profileId,
    rows_deleted: removeProfileRow ? 4 : 3,
    profile_row_deleted: removeProfileRow,
  })),
}));

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: () => true,
}));

vi.mock("@/app/features/runtime/native-adapters", () => ({
  invokeNativeCommand: vi.fn(async () => ({ ok: true as const, value: undefined })),
}));

describe("profile-local-reset-service", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("clears operator trust overrides and relay list keys on cache reset", async () => {
    localStorage.setItem(COORDINATION_OVERRIDE_KEY, "https://coord.example");
    localStorage.setItem(WORKSPACE_RELAY_KEY, "wss://relay.example");
    localStorage.setItem(
      getScopedStorageKey(`obscur.relay_list.v2.${PUBLIC_KEY}`, "default"),
      "[]",
    );
    localStorage.setItem("obscur_remember_me::default", "true");

    const report = await clearProfileLocalCachesKeepingIdentity({
      profileId: "default",
      publicKeyHex: PUBLIC_KEY,
    });

    expect(localStorage.getItem(COORDINATION_OVERRIDE_KEY)).toBeNull();
    expect(localStorage.getItem(WORKSPACE_RELAY_KEY)).toBeNull();
    expect(localStorage.getItem(getScopedStorageKey(`obscur.relay_list.v2.${PUBLIC_KEY}`, "default"))).toBeNull();
    expect(localStorage.getItem("obscur_remember_me::default")).toBe("true");
    expect(report.operatorConfigCleared).toBe(true);
    expect(report.sqliteWiped).toBe(true);
    expect(report.tier).toBe("caches_only");
  });

  it("runs complete removal with sqlite profile row delete and webview clear", async () => {
    localStorage.setItem(`dweb.nostr.pwa.blocklist.${PUBLIC_KEY}`, JSON.stringify({
      version: 1,
      blockedPublicKeys: [],
    }));

    const report = await completeProfileLocalDataRemoval({
      profileId: "default",
      publicKeyHex: PUBLIC_KEY,
    });

    expect(report.tier).toBe("complete");
    expect(report.sqliteRowsDeleted).toBe(4);
    expect(report.webviewDataCleared).toBe(true);
    expect(report.blocklistCleared).toBe(true);
    expect(localStorage.getItem(`dweb.nostr.pwa.blocklist.${PUBLIC_KEY}`)).toBeNull();
  });
});
