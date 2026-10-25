import { describe, expect, it } from "vitest";
import { shouldOfferEmptyDeviceContinuityGate } from "./empty-device-continuity-policy";

describe("shouldOfferEmptyDeviceContinuityGate", () => {
  const readyEmpty = {
    identityReady: true,
    peerTrustHydrated: true,
    messagingHydrated: true,
    acceptedPeerCount: 0,
    localConnectionCount: 0,
    dismissed: false,
  } as const;

  it("offers when identity is ready and local graph is empty", () => {
    expect(shouldOfferEmptyDeviceContinuityGate(readyEmpty)).toBe(true);
  });

  it("waits until peer trust and messaging have hydrated", () => {
    expect(shouldOfferEmptyDeviceContinuityGate({
      ...readyEmpty,
      peerTrustHydrated: false,
    })).toBe(false);
    expect(shouldOfferEmptyDeviceContinuityGate({
      ...readyEmpty,
      messagingHydrated: false,
    })).toBe(false);
  });

  it("hides when contacts or local connections already exist", () => {
    expect(shouldOfferEmptyDeviceContinuityGate({
      ...readyEmpty,
      acceptedPeerCount: 1,
    })).toBe(false);
    expect(shouldOfferEmptyDeviceContinuityGate({
      ...readyEmpty,
      localConnectionCount: 2,
    })).toBe(false);
  });

  it("respects session dismiss and locked identity", () => {
    expect(shouldOfferEmptyDeviceContinuityGate({
      ...readyEmpty,
      dismissed: true,
    })).toBe(false);
    expect(shouldOfferEmptyDeviceContinuityGate({
      ...readyEmpty,
      identityReady: false,
    })).toBe(false);
  });
});
