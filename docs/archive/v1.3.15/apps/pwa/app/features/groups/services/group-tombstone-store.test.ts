import { beforeEach, describe, expect, it } from "vitest";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { addGroupTombstone, isGroupTombstoned, loadGroupTombstones, toGroupTombstoneKey } from "./group-tombstone-store";

const PUBLIC_KEY = "a".repeat(64);
const GROUP_ID = "group-1";
const RELAY_URL = "wss://relay.example";
const LEGACY_STORAGE_KEY = `obscur.group.tombstones.v1.${PUBLIC_KEY}`;
const SCOPED_STORAGE_KEY = getScopedStorageKey(LEGACY_STORAGE_KEY);

describe("group-tombstone-store storage compatibility", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("writes tombstones to scoped storage key", () => {
    addGroupTombstone(PUBLIC_KEY, { groupId: GROUP_ID, relayUrl: RELAY_URL });
    const raw = window.localStorage.getItem(SCOPED_STORAGE_KEY);
    expect(raw).not.toBeNull();
  });

  it("loads tombstones from legacy storage key", () => {
    const tombstone = toGroupTombstoneKey({ groupId: GROUP_ID, relayUrl: RELAY_URL });
    window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify([tombstone]));
    const loaded = loadGroupTombstones(PUBLIC_KEY);
    expect(loaded.has(tombstone)).toBe(true);
    expect(isGroupTombstoned(PUBLIC_KEY, { groupId: GROUP_ID, relayUrl: RELAY_URL })).toBe(true);
  });
});

