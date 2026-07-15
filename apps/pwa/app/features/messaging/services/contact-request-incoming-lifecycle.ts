import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { appendCanonicalContactEvent } from "@/app/features/account-sync/services/account-event-ingest-bridge";
import type { ConnectionReceiveLifecycleTag } from "./contact-request-receive-classifier";
import { requestFlowEvidenceStore } from "./request-flow-evidence-store";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

type IncomingLifecycleDeps = Readonly<{
  accountPublicKeyHex?: PublicKeyHex | null;
  profileId?: string;
  peerTrust?: Readonly<{
    acceptPeer: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
  }>;
  requestsInbox?: Readonly<{
    getRequestStatus: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => Readonly<{
      status?: string;
      isOutgoing?: boolean;
    }> | null;
    setStatus: (params: Readonly<{
      peerPublicKeyHex: PublicKeyHex;
      status: "accepted" | "declined" | "canceled";
      isOutgoing?: boolean;
    }>) => void;
  }>;
}>;

export type ApplyIncomingContactLifecycleParams = Readonly<{
  lifecycleTag: Extract<
    ConnectionReceiveLifecycleTag,
    "connection-accept" | "connection-decline" | "connection-cancel"
  >;
  peerPublicKeyHex: PublicKeyHex;
  requestEventId?: string;
  isSelfAuthored: boolean;
}>;

export const applyIncomingContactLifecycle = async (
  deps: IncomingLifecycleDeps,
  params: ApplyIncomingContactLifecycleParams,
): Promise<void> => {
  if (params.isSelfAuthored) {
    return;
  }

  const profileId = deps.profileId ?? getResolvedProfileId();
  const existing = deps.requestsInbox?.getRequestStatus({ peerPublicKeyHex: params.peerPublicKeyHex });
  const isOutgoing = params.lifecycleTag === "connection-decline" && !params.isSelfAuthored
    ? (existing?.isOutgoing ?? true)
    : (existing?.isOutgoing ?? false);

  if (params.lifecycleTag === "connection-accept") {
    requestFlowEvidenceStore.markAccept({
      peerPublicKeyHex: params.peerPublicKeyHex,
      requestEventId: params.requestEventId,
      profileId,
    });
    deps.peerTrust?.acceptPeer({ publicKeyHex: params.peerPublicKeyHex });
    deps.requestsInbox?.setStatus({
      peerPublicKeyHex: params.peerPublicKeyHex,
      status: "accepted",
      isOutgoing,
    });
    if (deps.accountPublicKeyHex) {
      await appendCanonicalContactEvent({
        accountPublicKeyHex: deps.accountPublicKeyHex,
        peerPublicKeyHex: params.peerPublicKeyHex,
        type: "CONTACT_ACCEPTED",
        direction: isOutgoing ? "outgoing" : "incoming",
        requestEventId: params.requestEventId,
        idempotencySuffix: params.requestEventId || params.peerPublicKeyHex,
        source: "legacy_bridge",
      });
    }
    return;
  }

  if (params.lifecycleTag === "connection-decline") {
    deps.requestsInbox?.setStatus({
      peerPublicKeyHex: params.peerPublicKeyHex,
      status: "declined",
      isOutgoing,
    });
    requestFlowEvidenceStore.reset(params.peerPublicKeyHex, profileId);
    if (deps.accountPublicKeyHex) {
      await appendCanonicalContactEvent({
        accountPublicKeyHex: deps.accountPublicKeyHex,
        peerPublicKeyHex: params.peerPublicKeyHex,
        type: "CONTACT_DECLINED",
        direction: isOutgoing ? "outgoing" : "incoming",
        requestEventId: params.requestEventId,
        idempotencySuffix: params.requestEventId || params.peerPublicKeyHex,
        source: "legacy_bridge",
      });
    }
    return;
  }

  deps.requestsInbox?.setStatus({
    peerPublicKeyHex: params.peerPublicKeyHex,
    status: "canceled",
    isOutgoing: true,
  });
  requestFlowEvidenceStore.reset(params.peerPublicKeyHex, profileId);
  if (deps.accountPublicKeyHex) {
    await appendCanonicalContactEvent({
      accountPublicKeyHex: deps.accountPublicKeyHex,
      peerPublicKeyHex: params.peerPublicKeyHex,
      type: "CONTACT_CANCELED",
      direction: "outgoing",
      requestEventId: params.requestEventId,
      idempotencySuffix: params.requestEventId || params.peerPublicKeyHex,
      source: "legacy_bridge",
    });
  }
};

export const applyIncomingContactWireEvidence = (params: Readonly<{
  lifecycleTag: Extract<ConnectionReceiveLifecycleTag, "connection-received" | "connection-receipt">;
  peerPublicKeyHex: PublicKeyHex;
  requestEventId?: string;
  profileId?: string;
}>): void => {
  const profileId = params.profileId ?? getResolvedProfileId();
  if (params.lifecycleTag === "connection-receipt") {
    requestFlowEvidenceStore.markReceiptAck({
      peerPublicKeyHex: params.peerPublicKeyHex,
      requestEventId: params.requestEventId,
      profileId,
    });
    return;
  }
  requestFlowEvidenceStore.markRequestPublished({
    peerPublicKeyHex: params.peerPublicKeyHex,
    requestEventId: params.requestEventId,
    profileId,
  });
};
