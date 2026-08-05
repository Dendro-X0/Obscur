import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DM_ALL_TIMELINE_KEY,
  loadSqliteRelayCheckpointFrontier,
  mirrorTimelineCheckpointToSqlite,
  resolveSqliteRelayCheckpointFrontier,
} from "./relay-checkpoint-sqlite-store";

const dbMocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => true),
}));

const transportMocks = vi.hoisted(() => ({
  listRelayCheckpoints: vi.fn(async () => [] as ReadonlyArray<{
    profile_id: string;
    relay_url: string;
    last_event_at: number;
  }>),
  upsertRelayCheckpoint: vi.fn(async () => undefined),
  getHost: vi.fn((): { invoke: ReturnType<typeof vi.fn> } | null => ({ invoke: vi.fn() })),
}));

vi.mock("@dweb/db", () => ({
  isTauri: dbMocks.isTauri,
}));

vi.mock("@obscur/transport-engine", () => ({
  listRelayCheckpoints: transportMocks.listRelayCheckpoints,
  upsertRelayCheckpoint: transportMocks.upsertRelayCheckpoint,
}));

vi.mock("@/app/features/transport-kernel/transport-engine-host-port", () => ({
  getTransportEngineHost: transportMocks.getHost,
}));

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

describe("relay-checkpoint-sqlite-store (ACC-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.isTauri.mockReturnValue(true);
    transportMocks.getHost.mockReturnValue({ invoke: vi.fn() });
  });

  it("resolves sqlite relay frontier as max last_event_at", () => {
    expect(resolveSqliteRelayCheckpointFrontier([
      { profile_id: "p1", relay_url: "wss://a", last_event_at: 100 },
      { profile_id: "p1", relay_url: "wss://b", last_event_at: 250 },
    ])).toBe(250);
  });

  it("mirrors dm:all checkpoint via transport upsertRelayCheckpoint", async () => {
    await mirrorTimelineCheckpointToSqlite({
      profileId: "default",
      timelineKey: DM_ALL_TIMELINE_KEY,
      lastProcessedAtUnixSeconds: 1_700_000_000,
      relayUrls: ["wss://relay.a", "wss://relay.b"],
    });

    expect(transportMocks.upsertRelayCheckpoint).toHaveBeenCalledTimes(2);
    expect(transportMocks.upsertRelayCheckpoint).toHaveBeenCalledWith({
      host: expect.anything(),
      profileId: "default",
      checkpoint: {
        profile_id: "default",
        relay_url: "wss://relay.a",
        last_event_at: 1_700_000_000,
      },
    });
  });

  it("skips mirror for non-dm:all timeline keys", async () => {
    await mirrorTimelineCheckpointToSqlite({
      profileId: "default",
      timelineKey: "dm:peer",
      lastProcessedAtUnixSeconds: 1,
      relayUrls: ["wss://relay.a"],
    });
    expect(transportMocks.upsertRelayCheckpoint).not.toHaveBeenCalled();
  });

  it("skips mirror when transport host unavailable", async () => {
    transportMocks.getHost.mockReturnValueOnce(null);
    await mirrorTimelineCheckpointToSqlite({
      profileId: "default",
      timelineKey: DM_ALL_TIMELINE_KEY,
      lastProcessedAtUnixSeconds: 1,
      relayUrls: ["wss://relay.a"],
    });
    expect(transportMocks.upsertRelayCheckpoint).not.toHaveBeenCalled();
  });

  it("loads frontier via transport listRelayCheckpoints", async () => {
    transportMocks.listRelayCheckpoints.mockResolvedValueOnce([
      { profile_id: "default", relay_url: "wss://relay.a", last_event_at: 42 },
    ]);
    await expect(loadSqliteRelayCheckpointFrontier("default")).resolves.toBe(42);
    expect(transportMocks.listRelayCheckpoints).toHaveBeenCalledWith({
      host: expect.anything(),
      profileId: "default",
    });
  });

  it("returns null when transport host unavailable", async () => {
    transportMocks.getHost.mockReturnValueOnce(null);
    await expect(loadSqliteRelayCheckpointFrontier("default")).resolves.toBeNull();
    expect(transportMocks.listRelayCheckpoints).not.toHaveBeenCalled();
  });

  it("source does not call bare db checkpoint IPC", () => {
    const source = readFileSync(join(__dirname, "relay-checkpoint-sqlite-store.ts"), "utf8");
    expect(source).toContain("listRelayCheckpoints");
    expect(source).toContain("upsertRelayCheckpoint");
    expect(source).not.toMatch(/\bdbGetRelayCheckpoints\b/);
    expect(source).not.toMatch(/\bdbUpsertRelayCheckpoint\b/);
  });
});
