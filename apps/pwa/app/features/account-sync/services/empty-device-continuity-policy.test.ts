import { afterEach, describe, expect, it } from "vitest";
import {
  readEmptyDeviceContinuityDismissed,
  shouldOfferEmptyDeviceContinuityGate,
  writeEmptyDeviceContinuityDismissed,
} from "./empty-device-continuity-policy";

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

  it("respects durable dismiss and locked identity", () => {
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

describe("empty device continuity dismiss persistence", () => {
  const profileId = "default";
  const publicKeyHex = "a".repeat(64);

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("survives a simulated app relaunch via localStorage", () => {
    writeEmptyDeviceContinuityDismissed(profileId, publicKeyHex);
    window.sessionStorage.clear();
    expect(readEmptyDeviceContinuityDismissed(profileId, publicKeyHex)).toBe(true);
  });

  it("migrates legacy sessionStorage dismiss into localStorage", () => {
    const key = `obscur.empty_device_continuity.dismissed.v1.${profileId}.${publicKeyHex}`;
    window.sessionStorage.setItem(key, "1");
    expect(readEmptyDeviceContinuityDismissed(profileId, publicKeyHex)).toBe(true);
    expect(window.localStorage.getItem(key)).toBe("1");
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });
});
