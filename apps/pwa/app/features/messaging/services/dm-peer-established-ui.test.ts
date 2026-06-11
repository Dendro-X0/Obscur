import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  resolveDmPeerEstablishedForUi,
  resolveDmPeerOutgoingWaitInitiatorForUi,
} from "./dm-peer-established-ui";

const PEER_A = "b".repeat(64) as PublicKeyHex;

describe("dm-peer-established-ui", () => {
  it("treats an established DM thread as accepted during trust/inbox hydration gap", () => {
    expect(resolveDmPeerEstablishedForUi({
      peerPublicKeyHex: PEER_A,
      isPeerAcceptedByTrust: false,
      requestStatus: null,
      establishedDmPeerPubkeys: new Set([PEER_A]),
    })).toBe(true);
  });

  it("does not treat unknown peers with empty inbox as established", () => {
    expect(resolveDmPeerEstablishedForUi({
      peerPublicKeyHex: PEER_A,
      isPeerAcceptedByTrust: false,
      requestStatus: null,
      establishedDmPeerPubkeys: new Set(),
    })).toBe(false);
  });

  it("suppresses outgoing-wait initiator banner for established DM threads", () => {
    expect(resolveDmPeerOutgoingWaitInitiatorForUi({
      peerPublicKeyHex: PEER_A,
      requestStatus: null,
      hasInboxItemForPeer: false,
      establishedDmPeerPubkeys: new Set([PEER_A]),
    })).toBe(false);
  });

  it("keeps outgoing-wait initiator for genuine pending strangers", () => {
    expect(resolveDmPeerOutgoingWaitInitiatorForUi({
      peerPublicKeyHex: PEER_A,
      requestStatus: { isOutgoing: true, status: "pending" },
      hasInboxItemForPeer: true,
      establishedDmPeerPubkeys: new Set(),
    })).toBe(true);
  });
});
