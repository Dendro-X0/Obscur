import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { ContactRequestStatus } from "@/app/features/search/types/discovery";
import type { ConnectionRequestStatusValue } from "@/app/features/messaging/types";
import { appendCanonicalContactEvent } from "@/app/features/account-sync/services/account-event-ingest-bridge";
import type { SendResult } from "../controllers/enhanced-dm-controller";
import {
  createEmptyRequestFlowEvidence,
  type RequestConvergenceState,
  type RequestFlowEvidence,
  type RequestTransportStatus,
} from "./request-flow-contracts";
import { requestFlowEvidenceStore } from "./request-flow-evidence-store";

type RequestInboxStatus = Readonly<{
  status?: ConnectionRequestStatusValue;
  isOutgoing: boolean;
}> | null;

type RequestEvidenceStore = Readonly<{
  get: (peerPublicKeyHex: string) => RequestFlowEvidence;
  markRequestPublished: (params: Readonly<{ peerPublicKeyHex: string; requestEventId?: string }>) => RequestFlowEvidence;
  markReceiptAck: (params: Readonly<{ peerPublicKeyHex: string; requestEventId?: string }>) => RequestFlowEvidence;
  markAccept: (params: Readonly<{ peerPublicKeyHex: string; requestEventId?: string }>) => RequestFlowEvidence;
  markTerminalFailure: (params: Readonly<{ peerPublicKeyHex: string }>) => RequestFlowEvidence;
  reset?: (peerPublicKeyHex: string) => void;
}>;

type RequestTransportDependencies = Readonly<{
  accountPublicKeyHex?: PublicKeyHex | null;
  sendConnectionRequest: (params: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    introMessage?: string;
  }>) => Promise<SendResult>;
  sendDm: (params: Readonly<{
    peerPublicKeyInput: string;
    plaintext: string;
    customTags?: string[][];
  }>) => Promise<SendResult>;
  requestsInbox?: {
    getRequestStatus: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex }>) => RequestInboxStatus;
    setStatus: (params: Readonly<{ peerPublicKeyHex: PublicKeyHex; status: ConnectionRequestStatusValue; isOutgoing?: boolean }>) => void;
  };
  peerTrust?: {
    acceptPeer: (params: Readonly<{ publicKeyHex: PublicKeyHex }>) => void;
  };
  evidenceStore?: RequestEvidenceStore;
}>;

export type RequestTransportOutcome = Readonly<{
  status: RequestTransportStatus;
  convergenceState: RequestConvergenceState;
  evidence: RequestFlowEvidence;
  reasonCode?: string;
  message?: string;
  retryable: boolean;
  relaySuccessCount: number;
  relayTotal: number;
  retryAtUnixMs?: number;
}>;

const hasRelayDeliveryEvidence = (result: Pick<SendResult, "deliveryStatus" | "relayResults">): boolean => {
  if (result.deliveryStatus === "sent_quorum" || result.deliveryStatus === "sent_partial") return true;
  return result.relayResults.some((entry) => entry.success);
};

const mapSendResultToStatus = (result: SendResult): RequestTransportStatus => {
  if (result.deliveryStatus === "sent_quorum") return "ok";
  if (result.deliveryStatus === "sent_partial") return "partial";
  if (result.deliveryStatus === "queued_retrying") return "queued";
  if (result.deliveryStatus === "failed") return "failed";
  if (result.success) {
    const successCount = result.relayResults.filter((entry) => entry.success).length;
    const total = result.relayResults.length;
    if (total > 0 && successCount === total) return "ok";
    if (successCount > 0) return "partial";
  }
  return "failed";
};

const isRetryableSendFailure = (result: SendResult): boolean => {
  if (result.deliveryStatus === "queued_retrying" || typeof result.retryAtUnixMs === "number") return true;
  const transientReasons = new Set([
    "no_active_relays",
    "insufficient_writable_relays",
    "quorum_not_met",
    "publish_rejected",
    "storage_unavailable",
    "sync_failed",
  ]);
  if (result.failureReason && transientReasons.has(result.failureReason)) return true;
  return false;
};

export const deriveRequestConvergenceState = (params: Readonly<{
  inboxStatus?: ConnectionRequestStatusValue;
  evidence?: RequestFlowEvidence;
  outboxStatus?: ContactRequestStatus | "queued_retrying";
}>): RequestConvergenceState => {
  if (params.inboxStatus === "accepted" || params.evidence?.acceptSeen) {
    return "accepted";
  }
  if (params.inboxStatus === "declined" || params.inboxStatus === "canceled") {
    return "rejected";
  }
  if (params.outboxStatus === "failed") {
    return "terminal_failed";
  }
  if (params.evidence?.receiptAckSeen) {
    return "pending_evidenced";
  }
  if (
    params.inboxStatus === "pending"
    || params.outboxStatus === "queued"
    || params.outboxStatus === "publishing"
    || params.outboxStatus === "sent_partial"
    || params.outboxStatus === "sent_quorum"
    || params.outboxStatus === "queued_retrying"
  ) {
    return "pending_local";
  }
  return "none";
};

const toRequestTransportOutcome = (params: Readonly<{
  status: RequestTransportStatus;
  result: SendResult;
  evidence: RequestFlowEvidence;
  inboxStatus?: ConnectionRequestStatusValue;
}>): RequestTransportOutcome => {
  const relaySuccessCount = params.result.relayResults.filter((entry) => entry.success).length;
  const relayTotal = params.result.relayResults.length;
  const outboxStatus: ContactRequestStatus | "queued_retrying" =
    params.status === "ok"
      ? "sent_quorum"
      : params.status === "partial"
        ? "sent_partial"
        : params.status === "queued"
          ? "queued_retrying"
          : "failed";
  return {
    status: params.status,
    convergenceState: deriveRequestConvergenceState({
      inboxStatus: params.inboxStatus,
      evidence: params.evidence,
      outboxStatus,
    }),
    evidence: params.evidence,
    reasonCode: params.result.blockReason || params.result.failureReason,
    message: params.result.error,
    retryable: params.status === "queued" || (params.status === "failed" && isRetryableSendFailure(params.result)),
    relaySuccessCount,
    relayTotal,
    retryAtUnixMs: params.result.retryAtUnixMs,
  };
};

const resolveInboxStatus = (
  requestsInbox: RequestTransportDependencies["requestsInbox"] | undefined,
  peerPublicKeyHex: PublicKeyHex
): ConnectionRequestStatusValue | undefined => {
  const status = requestsInbox?.getRequestStatus({ peerPublicKeyHex });
  return status?.status;
};

const canCommitAcceptedState = (
  status: RequestTransportStatus,
  result: Pick<SendResult, "deliveryStatus" | "relayResults">
): boolean => {
  if (status !== "ok" && status !== "partial") {
    return false;
  }
  return hasRelayDeliveryEvidence(result);
};

const canCommitTerminalRequestState = (
  status: RequestTransportStatus,
  result: Pick<SendResult, "deliveryStatus" | "relayResults">
): boolean => {
  if (status !== "ok" && status !== "partial") {
    return false;
  }
  return hasRelayDeliveryEvidence(result);
};

export const createRequestTransportService = (deps: RequestTransportDependencies) => {
  const evidenceStore = deps.evidenceStore ?? requestFlowEvidenceStore;

  const createNoWritableRelayFailure = (peerPublicKeyHex: PublicKeyHex): SendResult => ({
    success: false,
    deliveryStatus: "failed",
    messageId: "",
    relayResults: [],
    error: "No writable relays available. Obscur is still recovering the connection.",
    failureReason: "no_active_relays",
  });

  const sendConnectionRequestRaw = async (params: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    introMessage?: string;
  }>): Promise<SendResult> => {
    const result = await deps.sendConnectionRequest(params);
    if (hasRelayDeliveryEvidence(result)) {
      evidenceStore.markRequestPublished({
        peerPublicKeyHex: params.peerPublicKeyHex,
        requestEventId: result.messageId || undefined,
      });
    } else if (mapSendResultToStatus(result) === "failed") {
      evidenceStore.markTerminalFailure({ peerPublicKeyHex: params.peerPublicKeyHex });
    }
    return result;
  };

  const sendRequest = async (params: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    introMessage?: string;
  }>): Promise<RequestTransportOutcome> => {
    const result = await sendConnectionRequestRaw(params);
    if (deps.accountPublicKeyHex && hasRelayDeliveryEvidence(result)) {
      await appendCanonicalContactEvent({
        accountPublicKeyHex: deps.accountPublicKeyHex,
        peerPublicKeyHex: params.peerPublicKeyHex,
        type: "CONTACT_REQUEST_SENT",
        direction: "outgoing",
        requestEventId: result.messageId || undefined,
        idempotencySuffix: result.messageId || params.peerPublicKeyHex,
        source: "legacy_bridge",
      });
    }
    const status = mapSendResultToStatus(result);
    const evidence = evidenceStore.get(params.peerPublicKeyHex);
    return toRequestTransportOutcome({
      status,
      result,
      evidence,
      inboxStatus: resolveInboxStatus(deps.requestsInbox, params.peerPublicKeyHex),
    });
  };

  const acceptIncomingRequest = async (params: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    plaintext?: string;
    requestEventId?: string;
  }>): Promise<RequestTransportOutcome> => {
    const result = await deps.sendDm({
      peerPublicKeyInput: params.peerPublicKeyHex,
      plaintext: params.plaintext || "Accepted",
      customTags: params.requestEventId
        ? [["t", "connection-accept"], ["e", params.requestEventId]]
        : [["t", "connection-accept"]],
    });

    const status = mapSendResultToStatus(result);
    const shouldCommitAcceptedState = canCommitAcceptedState(status, result);

    if (shouldCommitAcceptedState) {
      evidenceStore.markAccept({
        peerPublicKeyHex: params.peerPublicKeyHex,
        requestEventId: params.requestEventId || undefined,
      });
      deps.peerTrust?.acceptPeer({ publicKeyHex: params.peerPublicKeyHex });
      deps.requestsInbox?.setStatus({
        peerPublicKeyHex: params.peerPublicKeyHex,
        status: "accepted",
        isOutgoing: false,
      });
      if (deps.accountPublicKeyHex) {
        await appendCanonicalContactEvent({
          accountPublicKeyHex: deps.accountPublicKeyHex,
          peerPublicKeyHex: params.peerPublicKeyHex,
          type: "CONTACT_ACCEPTED",
          direction: "incoming",
          requestEventId: params.requestEventId,
          idempotencySuffix: params.requestEventId || result.messageId || params.peerPublicKeyHex,
          source: "legacy_bridge",
        });
      }
    } else if (status === "failed") {
      evidenceStore.markTerminalFailure({ peerPublicKeyHex: params.peerPublicKeyHex });
    }

    const evidence = evidenceStore.get(params.peerPublicKeyHex);
    return toRequestTransportOutcome({
      status,
      result,
      evidence,
      inboxStatus: shouldCommitAcceptedState
        ? "accepted"
        : resolveInboxStatus(deps.requestsInbox, params.peerPublicKeyHex),
    });
  };

  const declineIncomingRequest = async (params: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    plaintext?: string;
    requestEventId?: string;
  }>): Promise<RequestTransportOutcome> => {
    const result = await deps.sendDm({
      peerPublicKeyInput: params.peerPublicKeyHex,
      plaintext: params.plaintext || "Declined",
      customTags: params.requestEventId
        ? [["t", "connection-decline"], ["e", params.requestEventId]]
        : [["t", "connection-decline"]],
    });

    const status = mapSendResultToStatus(result);
    const shouldCommitDeclinedState = canCommitTerminalRequestState(status, result);

    if (shouldCommitDeclinedState) {
      deps.requestsInbox?.setStatus({
        peerPublicKeyHex: params.peerPublicKeyHex,
        status: "declined",
        isOutgoing: false,
      });
      evidenceStore.reset?.(params.peerPublicKeyHex);
      if (deps.accountPublicKeyHex) {
        await appendCanonicalContactEvent({
          accountPublicKeyHex: deps.accountPublicKeyHex,
          peerPublicKeyHex: params.peerPublicKeyHex,
          type: "CONTACT_DECLINED",
          direction: "incoming",
          requestEventId: params.requestEventId,
          idempotencySuffix: params.requestEventId || result.messageId || params.peerPublicKeyHex,
          source: "legacy_bridge",
        });
      }
    } else if (status === "failed") {
      evidenceStore.markTerminalFailure({ peerPublicKeyHex: params.peerPublicKeyHex });
    }

    const evidence = evidenceStore.get(params.peerPublicKeyHex);
    return toRequestTransportOutcome({
      status,
      result,
      evidence,
      inboxStatus: shouldCommitDeclinedState
        ? "declined"
        : resolveInboxStatus(deps.requestsInbox, params.peerPublicKeyHex),
    });
  };

  const cancelOutgoingRequest = async (params: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    plaintext?: string;
    requestEventId?: string;
  }>): Promise<RequestTransportOutcome> => {
    const result = await deps.sendDm({
      peerPublicKeyInput: params.peerPublicKeyHex,
      plaintext: params.plaintext || "Canceled",
      customTags: params.requestEventId
        ? [["t", "connection-cancel"], ["e", params.requestEventId]]
        : [["t", "connection-cancel"]],
    });

    const status = mapSendResultToStatus(result);
    const shouldCommitCanceledState = canCommitTerminalRequestState(status, result);

    if (shouldCommitCanceledState) {
      deps.requestsInbox?.setStatus({
        peerPublicKeyHex: params.peerPublicKeyHex,
        status: "canceled",
        isOutgoing: true,
      });
      evidenceStore.reset?.(params.peerPublicKeyHex);
      if (deps.accountPublicKeyHex) {
        await appendCanonicalContactEvent({
          accountPublicKeyHex: deps.accountPublicKeyHex,
          peerPublicKeyHex: params.peerPublicKeyHex,
          type: "CONTACT_CANCELED",
          direction: "outgoing",
          requestEventId: params.requestEventId,
          idempotencySuffix: params.requestEventId || result.messageId || params.peerPublicKeyHex,
          source: "legacy_bridge",
        });
      }
    } else if (status === "failed") {
      evidenceStore.markTerminalFailure({ peerPublicKeyHex: params.peerPublicKeyHex });
    }

    const evidence = evidenceStore.get(params.peerPublicKeyHex);
    return toRequestTransportOutcome({
      status,
      result,
      evidence,
      inboxStatus: shouldCommitCanceledState
        ? "canceled"
        : resolveInboxStatus(deps.requestsInbox, params.peerPublicKeyHex),
    });
  };

  const recordIncomingWireEvidence = (params: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    type: "request" | "receipt_ack" | "accept";
    requestEventId?: string;
  }>): RequestFlowEvidence => {
    if (params.type === "accept") {
      return evidenceStore.markAccept({
        peerPublicKeyHex: params.peerPublicKeyHex,
        requestEventId: params.requestEventId,
      });
    }
    if (params.type === "receipt_ack") {
      return evidenceStore.markReceiptAck({
        peerPublicKeyHex: params.peerPublicKeyHex,
        requestEventId: params.requestEventId,
      });
    }
    return evidenceStore.markRequestPublished({
      peerPublicKeyHex: params.peerPublicKeyHex,
      requestEventId: params.requestEventId,
    });
  };

  const getFlowEvidence = (peerPublicKeyHex: PublicKeyHex): RequestFlowEvidence => {
    return evidenceStore.get(peerPublicKeyHex) ?? createEmptyRequestFlowEvidence();
  };

  return {
    sendConnectionRequestRaw,
    sendRequest,
    acceptIncomingRequest,
    declineIncomingRequest,
    cancelOutgoingRequest,
    recordIncomingWireEvidence,
    getFlowEvidence,
  };
};

export const requestTransportInternals = {
  hasRelayDeliveryEvidence,
  mapSendResultToStatus,
  isRetryableSendFailure,
  canCommitAcceptedState,
  canCommitTerminalRequestState,
};
