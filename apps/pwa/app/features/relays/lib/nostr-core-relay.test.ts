import { describe, expect, it } from "vitest";
import { getRelaySnapshot, nostrCoreRelayInternals, publishViaRelayCore, type RelayPoolLike } from "./nostr-core-relay";

const createPool = (params: Readonly<{
  connections?: ReadonlyArray<Readonly<{ url: string; status: string }>>;
  publishResult?: Readonly<{
    success: boolean;
    successCount: number;
    totalRelays: number;
    metQuorum?: boolean;
    quorumRequired?: number;
    results: ReadonlyArray<Readonly<{ relayUrl: string; success: boolean; error?: string }>>;
    overallError?: string;
  }>;
}> = {}): RelayPoolLike => ({
  connections: params.connections ?? [],
  waitForConnection: async () => true,
  publishToUrls: async () => params.publishResult ?? {
    success: true,
    successCount: 1,
    totalRelays: 1,
    metQuorum: true,
    results: [{ relayUrl: "wss://relay.damus.io", success: true }],
  },
});

describe("nostr-core-relay", () => {
  it("builds writable relay snapshot from open connections", () => {
    const snapshot = getRelaySnapshot(createPool({
      connections: [
        { url: "wss://a", status: "open" },
        { url: "wss://b", status: "connecting" },
      ],
    }));
    expect(snapshot.writableRelayUrls).toEqual(["wss://a"]);
    expect(snapshot.openRelayCount).toBe(1);
  });

  it("maps full quorum success to ok", async () => {
    const result = await publishViaRelayCore({
      pool: createPool({
        connections: [{ url: "wss://a", status: "open" }],
        publishResult: {
          success: true,
          successCount: 1,
          totalRelays: 1,
          metQuorum: true,
          results: [{ relayUrl: "wss://a", success: true }],
        },
      }),
      payload: "event",
    });
    expect(result.status).toBe("ok");
    expect(result.value?.metQuorum).toBe(true);
  });

  it("maps partial success to partial", async () => {
    const result = await publishViaRelayCore({
      pool: createPool({
        connections: [{ url: "wss://a", status: "open" }, { url: "wss://b", status: "open" }],
        publishResult: {
          success: false,
          successCount: 1,
          totalRelays: 2,
          metQuorum: false,
          results: [
            { relayUrl: "wss://a", success: true },
            { relayUrl: "wss://b", success: false, error: "timeout" },
          ],
          overallError: "quorum_not_met",
        },
      }),
      payload: "event",
    });
    expect(result.status).toBe("partial");
    expect(result.reasonCode).toBe("quorum_not_met");
  });

  it("returns queued when no writable relays exist", async () => {
    const result = await publishViaRelayCore({
      pool: createPool({
        connections: [{ url: "wss://a", status: "connecting" }],
      }),
      payload: "event",
    });
    expect(result.status).toBe("queued");
    expect(result.reasonCode).toBe("no_writable_relays");
  });

  it("maps timeout-only relay publish failures to queued degraded state", async () => {
    const result = await publishViaRelayCore({
      pool: createPool({
        connections: [{ url: "wss://a", status: "open" }],
        publishResult: {
          success: false,
          successCount: 0,
          totalRelays: 1,
          metQuorum: false,
          results: [{ relayUrl: "wss://a", success: false, error: "Timeout waiting for OK response" }],
          overallError: "Timeout waiting for OK response",
        },
      }),
      payload: "event",
    });
    expect(result.status).toBe("queued");
    expect(result.reasonCode).toBe("relay_degraded");
  });

  it("outcome mapper infers quorum when absent", () => {
    const outcome = nostrCoreRelayInternals.toOutcome({
      success: false,
      successCount: 1,
      totalRelays: 3,
      results: [
        { relayUrl: "wss://a", success: true },
        { relayUrl: "wss://b", success: false, error: "timeout" },
        { relayUrl: "wss://c", success: false, error: "closed" },
      ],
    });
    expect(outcome.quorumRequired).toBe(2);
    expect(outcome.metQuorum).toBe(false);
    expect(outcome.failures.length).toBe(2);
  });

  it("classifies OK timeout as retryable relay degradation", () => {
    expect(nostrCoreRelayInternals.isRetryableRelayErrorMessage("Timeout waiting for OK response")).toBe(true);
    expect(nostrCoreRelayInternals.isRetryableRelayErrorMessage("HTTP error: 521")).toBe(true);
    expect(nostrCoreRelayInternals.isRetryableRelayErrorMessage("Relay status error")).toBe(true);
    expect(nostrCoreRelayInternals.isRetryableRelayErrorMessage("signature rejected")).toBe(false);
  });
});
