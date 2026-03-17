import { beforeEach, describe, expect, it } from "vitest";
import { failedIncomingEventStore, failedIncomingEventStoreInternals } from "./failed-incoming-event-store";

describe("failedIncomingEventStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
    failedIncomingEventStore.clear();
  });

  it("persists suppressed event ids per profile scope", () => {
    failedIncomingEventStore.suppress("event-1");

    expect(failedIncomingEventStore.isSuppressed("event-1")).toBe(true);
    expect(failedIncomingEventStoreInternals.readState().eventIds).toContain("event-1");
  });

  it("ignores empty event ids", () => {
    failedIncomingEventStore.suppress("");
    expect(failedIncomingEventStoreInternals.readState().eventIds).toHaveLength(0);
  });
});
