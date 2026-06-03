import { beforeEach, describe, expect, it, vi } from "vitest";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import {
  getSyncStatus,
  subscribeToCommunity,
  syncServiceInternals,
  unsubscribeFromCommunity,
} from "./community-sync-service";

const COMMUNITY_ID = "community-alpha";

describe("community-sync-service (REL-003)", () => {
  beforeEach(() => {
    syncServiceInternals.resetSyncState();
    setProfileScopeOverride(null);
  });

  it("scopes sync state by profile and community", () => {
    const pool = {
      subscribeToUrls: vi.fn(() => "sub-a"),
      unsubscribe: vi.fn(),
    };

    setProfileScopeOverride("profile-a");
    subscribeToCommunity(pool, COMMUNITY_ID, ["wss://relay.test"], "a".repeat(64));

    setProfileScopeOverride("profile-b");
    expect(getSyncStatus(COMMUNITY_ID).subscribed).toBe(false);

    subscribeToCommunity(pool, COMMUNITY_ID, ["wss://relay.test"], "b".repeat(64));
    expect(getSyncStatus(COMMUNITY_ID).subscribed).toBe(true);
    expect(pool.subscribeToUrls).toHaveBeenCalledTimes(2);

    unsubscribeFromCommunity(pool, COMMUNITY_ID);
    expect(getSyncStatus(COMMUNITY_ID).subscribed).toBe(false);

    setProfileScopeOverride("profile-a");
    expect(getSyncStatus(COMMUNITY_ID).subscribed).toBe(true);
  });

  it("builds distinct sync keys per profile scope", () => {
    expect(syncServiceInternals.syncStateKey(COMMUNITY_ID, "profile-a")).not.toBe(
      syncServiceInternals.syncStateKey(COMMUNITY_ID, "profile-b"),
    );
  });
});
