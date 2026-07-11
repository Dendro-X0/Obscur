import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  isPendingContactHandshake,
  resolveDmPeerEstablishedForUi,
  resolveDmPeerOutgoingWaitInitiatorForUi,
} from "./dm-peer-established-ui";

const PEER_A = "b".repeat(64) as PublicKeyHex;

describe("dm-peer-established-ui", () => {
  it("does not treat legacy DM thread rows as established without trust or accept evidence", () => {
    expect(resolveDmPeerEstablishedForUi({
      peerPublicKeyHex: PEER_A,
      isPeerAcceptedByTrust: false,
      requestStatus: null,
    })).toBe(false);
  });

  it("does not treat unknown peers with empty inbox as established", () => {
    expect(resolveDmPeerEstablishedForUi({
      peerPublicKeyHex: PEER_A,
      isPeerAcceptedByTrust: false,
      requestStatus: null,
    })).toBe(false);
  });

  it("keeps outgoing pending peers out of the Chats sidebar", () => {
    expect(isPendingContactHandshake({ isOutgoing: true, status: "pending" })).toBe(true);
    expect(resolveDmPeerEstablishedForUi({
      peerPublicKeyHex: PEER_A,
      isPeerAcceptedByTrust: false,
      requestStatus: { isOutgoing: true, status: "pending" },
    })).toBe(false);
  });

  it("keeps incoming pending peers out of the Chats sidebar", () => {
    expect(resolveDmPeerEstablishedForUi({
      peerPublicKeyHex: PEER_A,
      isPeerAcceptedByTrust: false,
      requestStatus: { isOutgoing: false, status: "pending" },
    })).toBe(false);
  });

  it("promotes relay-confirmed accepted requests into Chats", () => {
    expect(resolveDmPeerEstablishedForUi({
      peerPublicKeyHex: PEER_A,
      isPeerAcceptedByTrust: false,
      requestStatus: { isOutgoing: false, status: "accepted" },
    })).toBe(true);
  });

  it("marks only explicit outgoing-pending requests as initiator wait state", () => {
    expect(resolveDmPeerOutgoingWaitInitiatorForUi({
      requestStatus: { isOutgoing: true, status: "pending" },
    })).toBe(true);
    expect(resolveDmPeerOutgoingWaitInitiatorForUi({
      requestStatus: null,
    })).toBe(false);
    expect(resolveDmPeerOutgoingWaitInitiatorForUi({
      requestStatus: { isOutgoing: false, status: "pending" },
    })).toBe(false);
  });
});
