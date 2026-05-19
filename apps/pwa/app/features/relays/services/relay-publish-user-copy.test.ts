import { describe, expect, it } from "vitest";
import {
  getRelayPublishFailureUserMessage,
  inferRelayPublishReasonCode,
} from "./relay-publish-user-copy";

describe("relay-publish-user-copy", () => {
  it("maps no writable relays when nothing is connected", () => {
    expect(inferRelayPublishReasonCode({
      success: false,
      successCount: 0,
      totalRelays: 0,
      openRelayCount: 0,
    })).toBe("no_writable_relays");
  });

  it("maps partial quorum when some relays confirm", () => {
    expect(inferRelayPublishReasonCode({
      success: false,
      successCount: 1,
      totalRelays: 3,
      openRelayCount: 3,
    })).toBe("quorum_not_met");
  });

  it("maps degraded relay errors from publish failures", () => {
    expect(inferRelayPublishReasonCode({
      success: false,
      successCount: 0,
      totalRelays: 2,
      openRelayCount: 2,
      overallError: "WebSocket closed before OK",
    })).toBe("relay_degraded");
  });

  it("returns user-facing copy for publish failures", () => {
    expect(getRelayPublishFailureUserMessage({
      reasonCode: "no_writable_relays",
    })).toMatch(/No writable relays/i);

    expect(getRelayPublishFailureUserMessage({
      reasonCode: "quorum_not_met",
      successCount: 1,
      totalRelays: 3,
    })).toMatch(/partial \(1\/3\)/i);

    expect(getRelayPublishFailureUserMessage({
      reasonCode: "failed",
      error: "upstream reset",
    })).toMatch(/upstream reset/i);

    expect(getRelayPublishFailureUserMessage({
      reasonCode: "failed",
    })).toMatch(/could not be confirmed/i);

    expect(getRelayPublishFailureUserMessage({
      reasonCode: "retry_scheduled",
    })).toMatch(/queued/i);

    expect(getRelayPublishFailureUserMessage({
      reasonCode: "upload_timeout",
    })).toMatch(/timed out/i);
  });
});
