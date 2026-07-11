import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { DmConversation } from "@/app/features/messaging/types";
import {
  isLegacyOrphanDmThread,
  mergeLegacyOrphanRequestsInboxItems,
  resolveEffectiveContactRequestStatus,
} from "./contact-request-legacy-orphan";

const PEER_A = "a".repeat(64) as PublicKeyHex;

const legacyConnection = (): DmConversation => ({
  kind: "dm",
  id: "dm-test",
  pubkey: PEER_A,
  displayName: "Tester2",
  lastMessage: "Hello! I'd like to connect on Obscur.",
  unreadCount: 1,
  lastMessageTime: new Date("2026-07-10T12:00:00Z"),
});

describe("contact-request-legacy-orphan", () => {
  it("does not treat pre-ASE-1d thread rows without inbox or trust", () => {
    expect(isLegacyOrphanDmThread({
      peerPublicKeyHex: PEER_A,
      isPeerAcceptedByTrust: false,
      requestStatus: null,
      hasDmThreadRow: true,
    })).toBe(false);
  });

  it("does not treat trusted peers as legacy orphans", () => {
    expect(isLegacyOrphanDmThread({
      peerPublicKeyHex: PEER_A,
      isPeerAcceptedByTrust: true,
      requestStatus: null,
      hasDmThreadRow: true,
    })).toBe(false);
  });

  it("synthesizes pending request status for legacy orphan threads", () => {
    expect(resolveEffectiveContactRequestStatus({
      peerPublicKeyHex: PEER_A,
      isPeerAcceptedByTrust: false,
      requestStatus: { status: undefined, isOutgoing: false },
      hasDmThreadRow: true,
    })).toEqual({ status: "pending", isOutgoing: false });
  });

  it("uses sandbox pending status when a stranger thread exists without an inbox row", () => {
    expect(resolveEffectiveContactRequestStatus({
      peerPublicKeyHex: PEER_A,
      isPeerAcceptedByTrust: false,
      requestStatus: null,
      hasDmThreadRow: true,
    })).toEqual({ status: "pending", isOutgoing: false });
  });

  it("does not merge plain DM threads without request event evidence", () => {
    const merged = mergeLegacyOrphanRequestsInboxItems({
      inboxItems: [],
      createdConnections: [legacyConnection()],
      isPeerAcceptedByTrust: () => false,
      getRequestStatus: () => null,
    });

    expect(merged).toHaveLength(0);
  });
});
