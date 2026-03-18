import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  loadPeerLastActiveByPeerPubkey,
  peerInteractionStoreInternals,
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

  it("dispatches a window update event when peer activity changes", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    recordPeerLastActive({
      publicKeyHex: accountPubkey,
      peerPublicKeyHex: peerPubkey,
      activeAtMs: 1_000,
    });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: peerInteractionStoreInternals.storageUpdateEvent,
    }));
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

