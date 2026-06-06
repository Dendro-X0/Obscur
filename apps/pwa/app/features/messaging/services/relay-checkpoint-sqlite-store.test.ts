import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DM_ALL_TIMELINE_KEY,
  loadSqliteRelayCheckpointFrontier,
  mirrorTimelineCheckpointToSqlite,
  resolveSqliteRelayCheckpointFrontier,
} from "./relay-checkpoint-sqlite-store";

const dbMocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
  dbUpsertRelayCheckpoint: vi.fn(async () => undefined),
  dbGetRelayCheckpoints: vi.fn(async () => []),
}));

vi.mock("@dweb/db", () => ({
  isTauri: dbMocks.isTauri,
  dbUpsertRelayCheckpoint: dbMocks.dbUpsertRelayCheckpoint,
  dbGetRelayCheckpoints: dbMocks.dbGetRelayCheckpoints,
}));

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

describe("relay-checkpoint-sqlite-store (ACC-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.isTauri.mockReturnValue(true);
  });

  it("resolves sqlite relay frontier as max last_event_at", () => {
    expect(resolveSqliteRelayCheckpointFrontier([
      { profile_id: "p1", relay_url: "wss://a", last_event_at: 100 },
      { profile_id: "p1", relay_url: "wss://b", last_event_at: 250 },
    ])).toBe(250);
  });

  it("mirrors dm:all checkpoint to each relay on native", async () => {
    await mirrorTimelineCheckpointToSqlite({
      profileId: "default",
      timelineKey: DM_ALL_TIMELINE_KEY,
      lastProcessedAtUnixSeconds: 1_700_000_000,
      relayUrls: ["wss://relay.a", "wss://relay.b"],
    });

    expect(dbMocks.dbUpsertRelayCheckpoint).toHaveBeenCalledTimes(2);
    expect(dbMocks.dbUpsertRelayCheckpoint).toHaveBeenCalledWith({
      profile_id: "default",
      relay_url: "wss://relay.a",
      last_event_at: 1_700_000_000,
    });
  });

  it("skips mirror for non-dm:all timeline keys", async () => {
    await mirrorTimelineCheckpointToSqlite({
      profileId: "default",
      timelineKey: "dm:peer",
      lastProcessedAtUnixSeconds: 1,
      relayUrls: ["wss://relay.a"],
    });
    expect(dbMocks.dbUpsertRelayCheckpoint).not.toHaveBeenCalled();
  });

  it("loads frontier from sqlite checkpoints", async () => {
    dbMocks.dbGetRelayCheckpoints.mockResolvedValueOnce([
      { profile_id: "default", relay_url: "wss://relay.a", last_event_at: 42 },
    ]);
    await expect(loadSqliteRelayCheckpointFrontier("default")).resolves.toBe(42);
  });
});
