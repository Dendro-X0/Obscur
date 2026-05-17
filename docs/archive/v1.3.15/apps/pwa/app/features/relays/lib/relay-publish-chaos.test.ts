import { describe, expect, it } from "vitest";
import { publishViaRelayCore, type RelayPoolLike } from "./nostr-core-relay";
import { mapCoreResultToRelayPublishResult } from "./publish-outcome-mapper";

type ScriptedPublishResult = Readonly<{
  success: boolean;
  successCount: number;
  totalRelays: number;
  metQuorum?: boolean;
  quorumRequired?: number;
  results: ReadonlyArray<Readonly<{ relayUrl: string; success: boolean; error?: string }>>;
  failures?: ReadonlyArray<Readonly<{ relayUrl: string; success: boolean; error?: string }>>;
  overallError?: string;
}>;

const createScriptedPool = (params: Readonly<{
  initialConnections: ReadonlyArray<Readonly<{ url: string; status: string }>>;
  onWaitForConnection?: () => void | Promise<void>;
  publishResults: ReadonlyArray<ScriptedPublishResult>;
}>): RelayPoolLike => {
  const connections = params.initialConnections.map((entry) => ({ ...entry }));
  let publishIndex = 0;

  return {
    get connections() {
      return connections;
    },
    waitForConnection: async () => {
      await params.onWaitForConnection?.();
      return connections.some((connection) => connection.status === "open");
    },
    publishToUrls: async () => {
      const next = params.publishResults[publishIndex] ?? params.publishResults.at(-1);
      publishIndex += 1;
      if (!next) {
        throw new Error("No scripted publish result available");
      }
      return next;
    },
    getRelayCircuitState: (url: string) => {
      const status = connections.find((connection) => connection.url === url)?.status;
      return status === "open" ? "healthy" : "degraded";
    },
  };
};

describe("relay publish chaos", () => {
  it("queues a relay flap timeout window instead of hard-failing", async () => {
    const pool = createScriptedPool({
      initialConnections: [{ url: "wss://relay-1.example", status: "connecting" }],
      onWaitForConnection: () => undefined,
      publishResults: [
        {
          success: false,
          successCount: 0,
          totalRelays: 1,
          results: [{ relayUrl: "wss://relay-1.example", success: false, error: "Timeout waiting for OK response" }],
          overallError: "Timeout waiting for OK response",
        },
      ],
    });

    const result = await publishViaRelayCore({
      pool,
      payload: "event",
      scopedRelayUrls: ["wss://relay-1.example"],
      waitForConnectionMs: 25,
    });

    expect(result.status).toBe("queued");
    expect(result.reasonCode).toBe("no_writable_relays");
  });

  it("queues timeout-only publish failure after relays reopen under churn", async () => {
    const pool = createScriptedPool({
      initialConnections: [{ url: "wss://relay-1.example", status: "connecting" }],
      onWaitForConnection: () => {
        (pool.connections as Array<{ url: string; status: string }>)[0] = { url: "wss://relay-1.example", status: "open" };
      },
      publishResults: [
        {
          success: false,
          successCount: 0,
          totalRelays: 1,
          results: [{ relayUrl: "wss://relay-1.example", success: false, error: "Timeout waiting for OK response" }],
          overallError: "Timeout waiting for OK response",
        },
      ],
    });

    const result = await publishViaRelayCore({
      pool,
      payload: "event",
      scopedRelayUrls: ["wss://relay-1.example"],
      waitForConnectionMs: 25,
    });

    expect(result.status).toBe("queued");
    expect(result.reasonCode).toBe("relay_degraded");
    expect(result.value?.successCount).toBe(0);
  });

  it("keeps partial quorum deterministic under intermittent 503 and timeout failures", async () => {
    const result = await publishViaRelayCore({
      pool: createScriptedPool({
        initialConnections: [
          { url: "wss://relay-1.example", status: "open" },
          { url: "wss://relay-2.example", status: "open" },
          { url: "wss://relay-3.example", status: "open" },
        ],
        publishResults: [
          {
            success: false,
            successCount: 1,
            totalRelays: 3,
            metQuorum: false,
            quorumRequired: 2,
            results: [
              { relayUrl: "wss://relay-1.example", success: true },
              { relayUrl: "wss://relay-2.example", success: false, error: "503 Service Unavailable" },
              { relayUrl: "wss://relay-3.example", success: false, error: "Timeout waiting for OK response" },
            ],
            overallError: "Quorum not met under relay churn",
          },
        ],
      }),
      payload: "event",
      scopedRelayUrls: ["wss://relay-1.example", "wss://relay-2.example", "wss://relay-3.example"],
    });

    expect(result.status).toBe("partial");
    expect(result.reasonCode).toBe("quorum_not_met");

    const mapped = mapCoreResultToRelayPublishResult(result, [
      "wss://relay-1.example",
      "wss://relay-2.example",
      "wss://relay-3.example",
    ]);
    expect(mapped?.status).toBe("partial");
    expect(mapped?.successCount).toBe(1);
    expect(mapped?.metQuorum).toBe(false);
  });

  it("keeps quorum-met degraded publish as partial instead of failing", async () => {
    const result = await publishViaRelayCore({
      pool: createScriptedPool({
        initialConnections: [
          { url: "wss://relay-1.example", status: "open" },
          { url: "wss://relay-2.example", status: "open" },
          { url: "wss://relay-3.example", status: "open" },
        ],
        publishResults: [
          {
            success: true,
            successCount: 2,
            totalRelays: 3,
            metQuorum: true,
            quorumRequired: 2,
            results: [
              { relayUrl: "wss://relay-1.example", success: true },
              { relayUrl: "wss://relay-2.example", success: true },
              { relayUrl: "wss://relay-3.example", success: false, error: "503 Service Unavailable" },
            ],
          },
        ],
      }),
      payload: "event",
      scopedRelayUrls: ["wss://relay-1.example", "wss://relay-2.example", "wss://relay-3.example"],
    });

    expect(result.status).toBe("partial");
    expect(result.reasonCode).toBe("relay_degraded");
    expect(result.value?.metQuorum).toBe(true);
  });

  it("keeps hard relay rejection terminal when no retryable relay evidence exists", async () => {
    const result = await publishViaRelayCore({
      pool: createScriptedPool({
        initialConnections: [
          { url: "wss://relay-1.example", status: "open" },
          { url: "wss://relay-2.example", status: "open" },
        ],
        publishResults: [
          {
            success: false,
            successCount: 0,
            totalRelays: 2,
            results: [
              { relayUrl: "wss://relay-1.example", success: false, error: "blocked by relay policy" },
              { relayUrl: "wss://relay-2.example", success: false, error: "blocked by relay policy" },
            ],
            overallError: "blocked by relay policy",
          },
        ],
      }),
      payload: "event",
      scopedRelayUrls: ["wss://relay-1.example", "wss://relay-2.example"],
    });

    expect(result.status).toBe("failed");
    expect(result.reasonCode).toBe("quorum_not_met");

    const mapped = mapCoreResultToRelayPublishResult(result, ["wss://relay-1.example", "wss://relay-2.example"]);
    expect(mapped?.status).toBe("failed");
    expect(mapped?.overallError).toBe("blocked by relay policy");
  });
});
