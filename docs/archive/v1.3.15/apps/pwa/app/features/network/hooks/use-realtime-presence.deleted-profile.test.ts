import { beforeEach, describe, expect, it } from "vitest";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { realtimePresenceHookInternals } from "./use-realtime-presence";

const DELETED_PUBKEY = "d".repeat(64);
const NORMAL_PUBKEY = "e".repeat(64);

describe("realtimePresenceHookInternals.isPeerDeletedByCachedProfile", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns true when discovery cache profile has deleted marker in display name", () => {
    discoveryCache.upsertProfile({
      pubkey: DELETED_PUBKEY,
      displayName: "Deleted Account",
      about: "legacy",
    });

    expect(realtimePresenceHookInternals.isPeerDeletedByCachedProfile(DELETED_PUBKEY)).toBe(true);
  });

  it("returns true when discovery cache profile has deleted marker in about", () => {
    discoveryCache.upsertProfile({
      pubkey: DELETED_PUBKEY,
      displayName: "any",
      about: "This account has been deleted.",
    });

    expect(realtimePresenceHookInternals.isPeerDeletedByCachedProfile(DELETED_PUBKEY)).toBe(true);
  });

  it("returns false for normal or missing profiles", () => {
    discoveryCache.upsertProfile({
      pubkey: NORMAL_PUBKEY,
      displayName: "Alice",
      about: "Hello",
    });

    expect(realtimePresenceHookInternals.isPeerDeletedByCachedProfile(NORMAL_PUBKEY)).toBe(false);
    expect(realtimePresenceHookInternals.isPeerDeletedByCachedProfile("f".repeat(64))).toBe(false);
  });
});

