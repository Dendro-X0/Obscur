import { beforeEach, describe, expect, it } from "vitest";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import {
  requestEventTombstoneStore,
  requestEventTombstoneStoreInternals,
} from "./request-event-tombstone-store";

describe("request-event-tombstone-store", () => {
  beforeEach(() => {
    localStorage.clear();
    setProfileScopeOverride("default");
    requestEventTombstoneStore.clear();
  });

  it("suppresses handled request event ids", () => {
    expect(requestEventTombstoneStore.isSuppressed("evt-1")).toBe(false);
    requestEventTombstoneStore.suppress("evt-1");
    expect(requestEventTombstoneStore.isSuppressed("evt-1")).toBe(true);
  });

  it("isolates tombstones by profile scope", () => {
    requestEventTombstoneStore.suppress("evt-shared");
    setProfileScopeOverride("profile-b");

    expect(requestEventTombstoneStore.isSuppressed("evt-shared")).toBe(false);
    expect(requestEventTombstoneStoreInternals.readState().eventIds).toEqual([]);
  });
});
