import { describe, expect, it } from "vitest";
import { isVoiceCallSignalDeliveryAccepted } from "./voice-call-signal-delivery";

describe("isVoiceCallSignalDeliveryAccepted", () => {
  it("accepts sent_quorum and sent_partial", () => {
    expect(isVoiceCallSignalDeliveryAccepted({ deliveryStatus: "sent_quorum" })).toBe(true);
    expect(isVoiceCallSignalDeliveryAccepted({ deliveryStatus: "sent_partial" })).toBe(true);
  });

  it("accepts pending_ack so answer can proceed under flaky F-ACK", () => {
    expect(isVoiceCallSignalDeliveryAccepted({ deliveryStatus: "pending_ack" })).toBe(true);
  });

  it("accepts queued_retrying", () => {
    expect(isVoiceCallSignalDeliveryAccepted({ deliveryStatus: "queued_retrying" })).toBe(true);
  });

  it("accepts failed + partialWireDelivery + eventId", () => {
    expect(isVoiceCallSignalDeliveryAccepted({
      deliveryStatus: "failed",
      partialWireDelivery: true,
      eventId: "abc123",
    })).toBe(true);
  });

  it("rejects bare failed without wire evidence", () => {
    expect(isVoiceCallSignalDeliveryAccepted({
      deliveryStatus: "failed",
      partialWireDelivery: false,
      eventId: "abc123",
    })).toBe(false);
    expect(isVoiceCallSignalDeliveryAccepted({
      deliveryStatus: "failed",
      partialWireDelivery: true,
      eventId: "",
    })).toBe(false);
  });

  it("accepts legacy success / relayResults", () => {
    expect(isVoiceCallSignalDeliveryAccepted({
      deliveryStatus: undefined,
      success: true,
    })).toBe(true);
    expect(isVoiceCallSignalDeliveryAccepted({
      deliveryStatus: undefined,
      success: false,
      relayResults: [{ success: false }, { success: true }],
    })).toBe(true);
    expect(isVoiceCallSignalDeliveryAccepted({
      deliveryStatus: undefined,
      success: false,
      relayResults: [{ success: false }],
    })).toBe(false);
  });
});
