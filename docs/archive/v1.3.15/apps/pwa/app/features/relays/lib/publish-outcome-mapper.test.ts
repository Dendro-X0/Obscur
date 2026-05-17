import { describe, expect, it } from "vitest";
import {
  mapCoreResultToRelayPublishResult,
  mapLegacyPublishResultToRelayPublishResult,
  mapProtocolPublishReportToRelayPublishResult,
} from "./publish-outcome-mapper";

describe("publish-outcome-mapper", () => {
  it("maps protocol report into partial when quorum met with failures", () => {
    const mapped = mapProtocolPublishReportToRelayPublishResult(
      {
        successCount: 2,
        totalRelays: 3,
        metQuorum: true,
        failures: [{ relayUrl: "wss://relay-3", error: "timeout" }],
        elapsedMs: 33,
      },
      ["wss://relay-1", "wss://relay-2", "wss://relay-3"]
    );

    expect(mapped.status).toBe("partial");
    expect(mapped.success).toBe(true);
    expect(mapped.failures).toHaveLength(1);
  });

  it("maps core queued outcome deterministically", () => {
    const mapped = mapCoreResultToRelayPublishResult(
      {
        status: "queued",
        reasonCode: "no_writable_relays",
        message: "No writable relays available",
      },
      ["wss://relay-1", "wss://relay-2"]
    );

    expect(mapped?.status).toBe("queued");
    expect(mapped?.reasonCode).toBe("no_writable_relays");
    expect(mapped?.success).toBe(false);
  });

  it("maps legacy publish results with quorum_not_met reason on failure", () => {
    const mapped = mapLegacyPublishResultToRelayPublishResult({
      success: false,
      successCount: 0,
      totalRelays: 2,
      results: [
        { relayUrl: "wss://relay-1", success: false, error: "closed" },
        { relayUrl: "wss://relay-2", success: false, error: "timeout" },
      ],
      overallError: "all failed",
    });

    expect(mapped.status).toBe("failed");
    expect(mapped.reasonCode).toBe("quorum_not_met");
    expect(mapped.failures).toHaveLength(2);
  });
});
