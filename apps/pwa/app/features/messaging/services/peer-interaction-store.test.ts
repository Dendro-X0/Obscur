import { createProfileMessageBus } from "@dweb/core/profile-message-bus";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { setProfileRuntimeScope } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  loadPeerLastActiveByPeerPubkey,
  recordPeerLastActive,
} from "./peer-interaction-store";

describe("peer-interaction-store", () => {
  const accountPubkey = "a".repeat(64) as PublicKeyHex;
  const peerPubkey = "b".repeat(64) as PublicKeyHex;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setProfileRuntimeScope(null);
  });

  it("records peer last-active timestamps monotonically", () => {
    recordPeerLastActive({
      publicKeyHex: accountPubkey,
      peerPublicKeyHex: peerPubkey,
      activeAtMs: 1_000,
    });
    recordPeerLastActive({
      publicKeyHex: accountPubkey,
      peerPublicKeyHex: peerPubkey,
      activeAtMs: 500,
    });
    recordPeerLastActive({
      publicKeyHex: accountPubkey,
      peerPublicKeyHex: peerPubkey,
      activeAtMs: 2_000,
    });

    const state = loadPeerLastActiveByPeerPubkey(accountPubkey);
    expect(state[peerPubkey]).toBe(2_000);
  });

  it("publishes peer-interaction-updated on profile bus when peer activity changes", () => {
    const bus = createProfileMessageBus({ profileId: "default" });
    setProfileRuntimeScope({ profileId: "default", bus });
    const handler = vi.fn();
    const off = bus.subscribeTo("peer-interaction-updated", handler);
    recordPeerLastActive({
      publicKeyHex: accountPubkey,
      peerPublicKeyHex: peerPubkey,
      activeAtMs: 1_000,
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "peer-interaction-updated",
        detail: expect.objectContaining({
          publicKeyHex: accountPubkey,
          profileId: "default",
        }),
      }),
    );
    off();
  });

  it("ignores invalid timestamps", () => {
    recordPeerLastActive({
      publicKeyHex: accountPubkey,
      peerPublicKeyHex: peerPubkey,
      activeAtMs: Number.NaN,
    });
    expect(loadPeerLastActiveByPeerPubkey(accountPubkey)).toEqual({});
  });
});

