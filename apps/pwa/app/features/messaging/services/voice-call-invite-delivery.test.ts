import { describe, expect, it } from "vitest";
import {
  isVoiceCallInviteDeliveryAccepted,
  isVoiceCallInviteDeliveryPending,
  isVoiceCallInviteDeliveryProvisional,
  shouldStartVoiceCallInviteSession,
} from "./voice-call-invite-delivery";

describe("voice-call-invite-delivery", () => {
  it("accepts only confirmed quorum/partial", () => {
    expect(isVoiceCallInviteDeliveryAccepted("sent_quorum")).toBe(true);
    expect(isVoiceCallInviteDeliveryAccepted("sent_partial")).toBe(true);
    expect(isVoiceCallInviteDeliveryAccepted("pending_ack")).toBe(false);
    expect(isVoiceCallInviteDeliveryAccepted("failed")).toBe(false);
    expect(isVoiceCallInviteDeliveryAccepted("queued_retrying")).toBe(false);
  });

  it("flags Phase-1 pending_ack separately", () => {
    expect(isVoiceCallInviteDeliveryPending("pending_ack")).toBe(true);
    expect(isVoiceCallInviteDeliveryPending("failed")).toBe(false);
  });

  it("treats failed+partialWireDelivery+eventId as provisional wire", () => {
    expect(isVoiceCallInviteDeliveryProvisional({
      deliveryStatus: "failed",
      partialWireDelivery: true,
      eventId: "abc123",
    })).toBe(true);
    expect(isVoiceCallInviteDeliveryProvisional({
      deliveryStatus: "failed",
      partialWireDelivery: false,
      eventId: "abc123",
    })).toBe(false);
    expect(isVoiceCallInviteDeliveryProvisional({
      deliveryStatus: "failed",
      partialWireDelivery: true,
      eventId: "",
    })).toBe(false);
    expect(isVoiceCallInviteDeliveryProvisional({
      deliveryStatus: "sent_quorum",
      partialWireDelivery: true,
      eventId: "abc123",
    })).toBe(false);
  });

  it("starts session on confirmed or provisional wire", () => {
    expect(shouldStartVoiceCallInviteSession({
      deliveryStatus: "sent_quorum",
      eventId: "e1",
    })).toBe(true);
    expect(shouldStartVoiceCallInviteSession({
      deliveryStatus: "failed",
      partialWireDelivery: true,
      eventId: "e1",
    })).toBe(true);
    expect(shouldStartVoiceCallInviteSession({
      deliveryStatus: "failed",
      partialWireDelivery: false,
      eventId: "e1",
    })).toBe(false);
  });
});
