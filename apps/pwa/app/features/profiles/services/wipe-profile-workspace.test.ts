import { beforeEach, describe, expect, it, vi } from "vitest";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { wipeProfileWorkspaceCompletely } from "./wipe-profile-workspace";

vi.mock("@/app/features/messaging/services/local-history-reset-service", () => ({
  resetLocalHistoryKeepingIdentity: vi.fn(async () => ({
    profileId: "profile-2",
    publicKeyHex: null,
    removedLocalStorageKeyCount: 2,
    clearedIndexedDbStoreCount: 0,
    warnings: [],
  })),
}));

vi.mock("./profile-data-cleanup", () => ({
  clearProfileLocalData: vi.fn(async (profileId: string) => {
    if (typeof window !== "undefined") {
      const suffix = `::${profileId}`;
      const keys: string[] = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key?.endsWith(suffix)) {
          keys.push(key);
        }
      }
      keys.forEach((key) => window.localStorage.removeItem(key));
    }
  }),
}));

describe("wipeProfileWorkspaceCompletely", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clears scoped profile keys after history reset", async () => {
    const profileId = "profile-2";
    localStorage.setItem(getScopedStorageKey("obscur.test.marker", profileId), "1");
    localStorage.setItem(getScopedStorageKey("obscur.test.marker", "other"), "keep");

    const report = await wipeProfileWorkspaceCompletely({ profileId });

    expect(report.profileId).toBe(profileId);
    expect(localStorage.getItem(getScopedStorageKey("obscur.test.marker", profileId))).toBeNull();
    expect(localStorage.getItem(getScopedStorageKey("obscur.test.marker", "other"))).toBe("keep");
  });
});
