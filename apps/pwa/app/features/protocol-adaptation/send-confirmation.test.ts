import { describe, expect, it } from "vitest";
import type { SendConfirmation } from "./send-confirmation";
import { toCanonicalSendConfirmation } from "./send-confirmation";

describe("toCanonicalSendConfirmation (K7)", () => {
  it("drops relayResults and keeps aggregate counts", () => {
    const rich: SendConfirmation = {
      success: true,
      deliveryStatus: "sent_quorum",
      relayResults: [
        { relayUrl: "wss://a", success: true, latencyMs: 10 },
        { relayUrl: "wss://b", success: false, error: "timeout" },
      ],
      partialWireDelivery: false,
    };
    const canonical = toCanonicalSendConfirmation(rich);
    expect(canonical).toEqual({
      success: true,
      deliveryStatus: "sent_quorum",
      error: undefined,
      reasonCode: undefined,
      partialWireDelivery: false,
      successCount: 1,
      totalRelays: 2,
    });
    expect(canonical).not.toHaveProperty("relayResults");
  });

  it("maps failure fields", () => {
    const rich: SendConfirmation = {
      success: false,
      deliveryStatus: "failed",
      relayResults: [],
      error: "denied",
      reasonCode: "no_writable_relays",
      partialWireDelivery: true,
    };
    expect(toCanonicalSendConfirmation(rich)).toMatchObject({
      success: false,
      deliveryStatus: "failed",
      error: "denied",
      reasonCode: "no_writable_relays",
      partialWireDelivery: true,
      successCount: 0,
      totalRelays: 0,
    });
  });
});
