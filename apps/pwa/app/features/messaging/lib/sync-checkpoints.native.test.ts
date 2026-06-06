import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bootstrapTimelineCheckpointsFromSqlite,
  getTimelineCheckpoint,
  resetTimelineCheckpointsForTests,
  updateTimelineCheckpoint,
} from "./sync-checkpoints";
import { DM_ALL_TIMELINE_KEY } from "../services/relay-checkpoint-sqlite-store";

const sqliteMocks = vi.hoisted(() => ({
  loadSqliteRelayCheckpointFrontier: vi.fn(async () => null as number | null),
  mirrorTimelineCheckpointToSqlite: vi.fn(async () => undefined),
}));

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("../services/relay-checkpoint-sqlite-store", async () => {
  const actual = await vi.importActual<typeof import("../services/relay-checkpoint-sqlite-store")>(
    "../services/relay-checkpoint-sqlite-store",
  );
  return {
    ...actual,
    loadSqliteRelayCheckpointFrontier: sqliteMocks.loadSqliteRelayCheckpointFrontier,
    mirrorTimelineCheckpointToSqlite: sqliteMocks.mirrorTimelineCheckpointToSqlite,
  };
});

describe("sync-checkpoints native (ACC-03)", () => {
  beforeEach(() => {
    resetTimelineCheckpointsForTests();
    vi.clearAllMocks();
  });

  it("bootstraps dm:all from sqlite when localStorage is empty", async () => {
    sqliteMocks.loadSqliteRelayCheckpointFrontier.mockResolvedValueOnce(1_699_000_000);
    const bootstrapped = await bootstrapTimelineCheckpointsFromSqlite("default");
    expect(bootstrapped).toBe(true);
    expect(getTimelineCheckpoint(DM_ALL_TIMELINE_KEY, "default")).toEqual(
      expect.objectContaining({
        timelineKey: DM_ALL_TIMELINE_KEY,
        lastProcessedAtUnixSeconds: 1_699_000_000,
      }),
    );
  });

  it("mirrors dm:all updates to sqlite when relay urls are provided", async () => {
    updateTimelineCheckpoint(DM_ALL_TIMELINE_KEY, 1_700_000_100, "default", {
      relayUrls: ["wss://relay.example"],
    });
    expect(sqliteMocks.mirrorTimelineCheckpointToSqlite).toHaveBeenCalledWith({
      profileId: "default",
      timelineKey: DM_ALL_TIMELINE_KEY,
      lastProcessedAtUnixSeconds: 1_700_000_100,
      relayUrls: ["wss://relay.example"],
    });
  });
});
