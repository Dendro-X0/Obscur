import { describe, expect, it } from "vitest";
import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  buildCheckpointRelayUrlSet,
  listConfiguredRelayUrls,
  listRelayCheckpoints,
} from "./transport-persistence";

const hostWith = (handler: HostEnginePort["invoke"]): HostEnginePort => ({
  invoke: handler,
});

describe("transport persistence SDK", () => {
  it("listRelayCheckpoints invokes transport engine method", async () => {
    const host = hostWith(async (request) => {
      expect(request.engine).toBe("transport");
      expect(request.method).toBe("listRelayCheckpoints");
      expect(request.scope.profileId).toBe("default");
      return {
        ok: true,
        data: [{
          profile_id: "default",
          relay_url: "wss://team.relay",
          last_event_at: 1,
        }],
      };
    });
    const rows = await listRelayCheckpoints({ host, profileId: "default" });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.relay_url).toBe("wss://team.relay");
  });

  it("listConfiguredRelayUrls invokes transport engine method", async () => {
    const host = hostWith(async (request) => {
      expect(request.engine).toBe("transport");
      expect(request.method).toBe("listConfiguredRelayUrls");
      return { ok: true, data: ["wss://team.relay", "wss://backup.relay"] };
    });
    const urls = await listConfiguredRelayUrls({ host, profileId: "default" });
    expect(urls).toEqual(["wss://team.relay", "wss://backup.relay"]);
  });

  it("buildCheckpointRelayUrlSet dedupes trimmed urls", () => {
    const set = buildCheckpointRelayUrlSet([
      { profile_id: "p", relay_url: " wss://a ", last_event_at: 1 },
      { profile_id: "p", relay_url: "wss://a", last_event_at: 2 },
      { profile_id: "p", relay_url: "", last_event_at: 3 },
    ]);
    expect([...set]).toEqual(["wss://a"]);
  });
});
