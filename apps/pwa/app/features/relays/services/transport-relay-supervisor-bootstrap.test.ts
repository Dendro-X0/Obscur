import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  getTransportEngineHost,
  resetTransportEngineHostForTests,
} from "@/app/features/transport-kernel/transport-engine-host-port";
import {
  loadTransportConfiguredRelayUrls,
  loadTransportRelayPersistence,
  mergeSupervisorRelayUrlCandidates,
  resolveEngineCheckpointRelayUrls,
} from "./transport-relay-supervisor-bootstrap";

vi.mock("@/app/features/transport-kernel/transport-engine-host-port", () => ({
  getTransportEngineHost: vi.fn(),
  resetTransportEngineHostForTests: vi.fn(),
}));

vi.mock("@obscur/transport-engine", () => ({
  listConfiguredRelayUrls: vi.fn(),
  listRelayCheckpoints: vi.fn(),
  buildCheckpointRelayUrlSet: vi.fn((checkpoints: ReadonlyArray<{ relay_url: string }>) => (
    new Set(checkpoints.map((entry) => entry.relay_url.trim()).filter(Boolean))
  )),
}));

import { listConfiguredRelayUrls, listRelayCheckpoints } from "@obscur/transport-engine";

const mockedGetHost = vi.mocked(getTransportEngineHost);
const mockedListUrls = vi.mocked(listConfiguredRelayUrls);
const mockedListCheckpoints = vi.mocked(listRelayCheckpoints);

describe("transport-relay-supervisor-bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTransportEngineHostForTests();
  });

  it("returns empty when transport engine host is unavailable", async () => {
    mockedGetHost.mockReturnValue(null);
    await expect(loadTransportConfiguredRelayUrls({ profileId: "default" })).resolves.toEqual([]);
    expect(mockedListUrls).not.toHaveBeenCalled();
    expect(mockedListCheckpoints).not.toHaveBeenCalled();
  });

  it("loads configured relay URLs via transport-engine SDK", async () => {
    const host = { invoke: vi.fn() } as unknown as HostEnginePort;
    mockedGetHost.mockReturnValue(host);
    mockedListUrls.mockResolvedValue(["wss://team.relay", "wss://checkpoint.relay"]);
    mockedListCheckpoints.mockResolvedValue([]);

    await expect(loadTransportConfiguredRelayUrls({
      profileId: "profile-a",
      windowLabel: "main",
    })).resolves.toEqual(["wss://team.relay", "wss://checkpoint.relay"]);

    expect(mockedListUrls).toHaveBeenCalledWith({
      host,
      profileId: "profile-a",
      windowLabel: "main",
    });
  });

  it("loads relay persistence bundle with checkpoint ordering", async () => {
    const host = { invoke: vi.fn() } as unknown as HostEnginePort;
    mockedGetHost.mockReturnValue(host);
    mockedListUrls.mockResolvedValue(["wss://team.relay"]);
    mockedListCheckpoints.mockResolvedValue([
      { profile_id: "default", relay_url: "wss://older.relay", last_event_at: 10 },
      { profile_id: "default", relay_url: "wss://fresh.relay", last_event_at: 99 },
    ]);

    await expect(loadTransportRelayPersistence({ profileId: "default" })).resolves.toEqual({
      engineConfiguredRelayUrls: ["wss://team.relay"],
      relayCheckpoints: [
        { profile_id: "default", relay_url: "wss://older.relay", last_event_at: 10 },
        { profile_id: "default", relay_url: "wss://fresh.relay", last_event_at: 99 },
      ],
      engineCheckpointRelayUrls: ["wss://fresh.relay", "wss://older.relay"],
    });
  });

  it("orders checkpoint relay URLs by most recent sync evidence", () => {
    expect(resolveEngineCheckpointRelayUrls([
      { profile_id: "p", relay_url: "wss://a", last_event_at: 1 },
      { profile_id: "p", relay_url: "wss://b", last_event_at: 5 },
      { profile_id: "p", relay_url: "wss://a", last_event_at: 9 },
    ])).toEqual(["wss://a", "wss://b"]);
  });

  it("merges user and engine relay URLs without duplicates", () => {
    expect(mergeSupervisorRelayUrlCandidates({
      userEnabledRelayUrls: ["wss://relay.one", "wss://relay.two"],
      engineConfiguredRelayUrls: ["wss://relay.two", "wss://team.relay"],
    })).toEqual([
      "wss://relay.one",
      "wss://relay.two",
      "wss://team.relay",
    ]);
  });
});
