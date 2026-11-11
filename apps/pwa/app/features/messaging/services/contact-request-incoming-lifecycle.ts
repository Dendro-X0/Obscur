import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { appendCanonicalContactEvent } from "@/app/features/account-sync/services/account-event-ingest-bridge";
import { peerTrustInternals } from "@/app/features/network/hooks/use-peer-trust";
import type { ConnectionReceiveLifecycleTag } from "./contact-request-receive-classifier";
import { requestFlowEvidenceStore } from "./request-flow-evidence-store";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

const normalizePeerKey = (value: string): string => value.trim().toLowerCase();

const isPeerUnderRemovedMask = (
  accountPublicKeyHex: PublicKeyHex | null | undefined,
  peerPublicKeyHex: PublicKeyHex,
  profileId: string,
): boolean => {
  if (!accountPublicKeyHex) {
    return false;
  }
  const peer = normalizePeerKey(peerPublicKeyHex);
  if (!peer) {
    return false;
  }
  const trust = peerTrustInternals.loadFromStorage(accountPublicKeyHex, profileId);
  return trust.removedPeers.some((entry) => normalizePeerKey(entry) === peer);
};

  type IncomingLifecycleDeps = Readonly<{
  accountPublicKeyHex?: PublicKeyHex | null;
  profileId?: string;
  peerTrust?: Readonly<{
    acceptPeer: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
    unacceptPeer?: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
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
    /** Preferred on cancel/remove notify — clears legacy mirror + CONTACT_REMOVED. */
    remove?: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => void;
  }>;
}>;

export type ApplyIncomingContactLifecycleParams = Readonly<{
  lifecycleTag: Extract<
    ConnectionReceiveLifecycleTag,
    | "connection-accept"
    | "connection-decline"
    | "connection-cancel"
    | "connection-block"
    | "connection-unblock"
  >;
  peerPublicKeyHex: PublicKeyHex;
  requestEventId?: string;
  isSelfAuthored: boolean;
}>;

const demotePeerRelationship = async (
  deps: IncomingLifecycleDeps,
  params: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    requestEventId?: string;
    profileId: string;
  }>,
): Promise<void> => {
  deps.peerTrust?.unacceptPeer?.({ publicKeyHex: params.peerPublicKeyHex });
  requestFlowEvidenceStore.reset(params.peerPublicKeyHex, params.profileId);
  if (deps.requestsInbox?.remove) {
    deps.requestsInbox.remove({ peerPublicKeyHex: params.peerPublicKeyHex });
    return;
  }
  deps.requestsInbox?.setStatus({
    peerPublicKeyHex: params.peerPublicKeyHex,
    status: "canceled",
    isOutgoing: true,
  });
  if (deps.accountPublicKeyHex) {
    await appendCanonicalContactEvent({
      accountPublicKeyHex: deps.accountPublicKeyHex,
      peerPublicKeyHex: params.peerPublicKeyHex,
      type: "CONTACT_REMOVED",
      direction: "unknown",
      requestEventId: params.requestEventId,
      idempotencySuffix: params.requestEventId || params.peerPublicKeyHex,
      source: "legacy_bridge",
    });
  }
};

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

  if (params.lifecycleTag === "connection-unblock") {
    // Unblock does not auto-restore trust — peer must re-request / Accept.
    requestFlowEvidenceStore.reset(params.peerPublicKeyHex, profileId);
    return;
  }

  if (params.lifecycleTag === "connection-accept") {
    // Stale lookback / public-relay connection-accept must not lift Block/Remove mask
    // (Soft L3 REQ history flaps TRUSTED after cancel). Local Connect Accept goes
    // through requestTransport.acceptPeer directly.
    if (isPeerUnderRemovedMask(deps.accountPublicKeyHex, params.peerPublicKeyHex, profileId)) {
      return;
    }
    // Remote accept completes OUR outgoing invite only. Soft L3 lookback must not
    // Accept an incoming pending request / mark TRUSTED without Requests UI Accept.
    // @see specs/backend/p1-o4b-incoming-accept-no-auto-trust-design-2026-11-08.md
    if (existing?.isOutgoing !== true) {
      return;
    }
    requestFlowEvidenceStore.markAccept({
      peerPublicKeyHex: params.peerPublicKeyHex,
      requestEventId: params.requestEventId,
      profileId,
    });
    deps.peerTrust?.acceptPeer({ publicKeyHex: params.peerPublicKeyHex });
    deps.requestsInbox?.setStatus({
      peerPublicKeyHex: params.peerPublicKeyHex,
      status: "accepted",
      isOutgoing: true,
    });
    if (deps.accountPublicKeyHex) {
      await appendCanonicalContactEvent({
        accountPublicKeyHex: deps.accountPublicKeyHex,
        peerPublicKeyHex: params.peerPublicKeyHex,
        type: "CONTACT_ACCEPTED",
        direction: "outgoing",
        requestEventId: params.requestEventId,
        idempotencySuffix: params.requestEventId || params.peerPublicKeyHex,
        source: "legacy_bridge",
      });
    }
    return;
  }

  if (params.lifecycleTag === "connection-decline") {
    deps.peerTrust?.unacceptPeer?.({ publicKeyHex: params.peerPublicKeyHex });
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

  // Cancel/remove/block notify must demote trust — otherwise the other side stays
  // TRUSTED and ignores subsequent connection-requests (2026-11-06 reconnect).
  // Prefer remove(): clears sticky legacy accepted (accepted→CANCEL used to no-op)
  // and emits CONTACT_REMOVED. Avoid setStatus(canceled) stubs that merge-block
  // a later CONTACT_REQUEST_RECEIVED pending card (2026-11-07 Requests Partial).
  await demotePeerRelationship(deps, {
    peerPublicKeyHex: params.peerPublicKeyHex,
    requestEventId: params.requestEventId,
    profileId,
  });
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
