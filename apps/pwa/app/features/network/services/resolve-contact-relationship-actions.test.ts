import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { AccountProjectionSnapshot } from "@/app/features/account-sync/account-event-contracts";
import type { RequestProjection } from "@/app/features/messaging/services/request-status-projection";
import { resolveContactRelationshipActions } from "./resolve-contact-relationship-actions";

const PEER_A = "a".repeat(64) as PublicKeyHex;
const PEER_B = "b".repeat(64) as PublicKeyHex;

const acceptedProjection = (): AccountProjectionSnapshot => ({
  profileId: "default",
  accountPublicKeyHex: PEER_B,
  contactsByPeer: {
    [PEER_A]: {
      peerPublicKeyHex: PEER_A,
      status: "accepted",
      direction: "outgoing",
      lastEvidenceAtUnixMs: 1,
      lastEventId: "accepted-1",
    },
  },
  conversationsById: {},
  messagesByConversationId: {},
  sync: {
    checkpointsByTimelineKey: {},
    bootstrapImportApplied: true,
  },
  lastSequence: 1,
  updatedAtUnixMs: 1,
});

const pendingProjection = (): AccountProjectionSnapshot => ({
  ...acceptedProjection(),
  contactsByPeer: {
    [PEER_A]: {
      peerPublicKeyHex: PEER_A,
      status: "pending",
      direction: "outgoing",
      lastEvidenceAtUnixMs: 1,
      lastEventId: "pending-1",
      lastRequestEventId: "req-1",
    },
  },
});

const handshakeAccepted: RequestProjection = {
  state: "accepted",
  canSend: false,
  shouldDisablePrimaryAction: true,
};

const handshakePending: RequestProjection = {
  state: "sent_waiting",
  canSend: false,
  shouldDisablePrimaryAction: true,
};

describe("resolveContactRelationshipActions", () => {
  it("does not grant privileged actions on trust alone without handshake evidence", () => {
    expect(resolveContactRelationshipActions({
      peerPublicKeyHex: PEER_A,
      peerTrustAccepted: true,
      projection: null,
      useProjectionReads: false,
      requestProjection: handshakePending,
    })).toEqual({
      isTrustedContact: false,
      canMessage: false,
      canVoiceCall: false,
    });
  });

  it("grants privileged actions in legacy mode when trust and handshake agree", () => {
    expect(resolveContactRelationshipActions({
      peerPublicKeyHex: PEER_A,
      peerTrustAccepted: true,
      projection: null,
      useProjectionReads: false,
      requestProjection: handshakeAccepted,
    })).toEqual({
      isTrustedContact: true,
      canMessage: true,
      canVoiceCall: true,
    });
  });

  it("requires projection-backed acceptance when projection reads are enabled", () => {
    expect(resolveContactRelationshipActions({
      peerPublicKeyHex: PEER_A,
      peerTrustAccepted: true,
      projection: pendingProjection(),
      useProjectionReads: true,
      requestProjection: handshakeAccepted,
    })).toEqual({
      isTrustedContact: false,
      canMessage: false,
      canVoiceCall: false,
    });

    expect(resolveContactRelationshipActions({
      peerPublicKeyHex: PEER_A,
      peerTrustAccepted: true,
      projection: acceptedProjection(),
      useProjectionReads: true,
      requestProjection: handshakeAccepted,
    })).toEqual({
      isTrustedContact: true,
      canMessage: true,
      canVoiceCall: true,
    });
  });

  it("fails closed when projection reads are enabled but projection is not ready", () => {
    expect(resolveContactRelationshipActions({
      peerPublicKeyHex: PEER_A,
      peerTrustAccepted: true,
      projection: null,
      useProjectionReads: true,
      requestProjection: handshakeAccepted,
    })).toEqual({
      isTrustedContact: false,
      canMessage: false,
      canVoiceCall: false,
    });
  });

  it("blocks privileged actions after local removal even if projection still says accepted", () => {
    expect(resolveContactRelationshipActions({
      peerPublicKeyHex: PEER_A,
      peerTrustAccepted: false,
      projection: acceptedProjection(),
      useProjectionReads: true,
      requestProjection: handshakeAccepted,
    })).toEqual({
      isTrustedContact: false,
      canMessage: false,
      canVoiceCall: false,
    });
  });
});
