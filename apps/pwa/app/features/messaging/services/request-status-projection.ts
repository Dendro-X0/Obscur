import type { ConnectionRequestStatusValue } from "@/app/features/messaging/types";
import type { RequestFlowEvidence } from "./request-flow-contracts";

export const REQUEST_RESEND_GRACE_MS = 60_000;

export type RequestStatusSnapshot = Readonly<{
  status?: ConnectionRequestStatusValue;
  isOutgoing: boolean;
  lastReceivedAtUnixSeconds?: number;
}> | null;

export type RequestProjectionState =
  | "none"
  | "incoming_pending"
  | "sent_waiting"
  | "recipient_seen"
  | "retry_available"
  | "accepted"
  | "rejected";

export type RequestProjection = Readonly<{
  state: RequestProjectionState;
  canSend: boolean;
  shouldDisablePrimaryAction: boolean;
  ageMs?: number;
}>;

const getPendingAgeMs = (
  requestStatus: RequestStatusSnapshot,
  evidence: RequestFlowEvidence | undefined,
  nowUnixMs: number,
): number | undefined => {
  if (typeof requestStatus?.lastReceivedAtUnixSeconds === "number") {
    return nowUnixMs - (requestStatus.lastReceivedAtUnixSeconds * 1000);
  }
  if (typeof evidence?.lastEvidenceUnixMs === "number") {
    return nowUnixMs - evidence.lastEvidenceUnixMs;
  }
  return undefined;
};

export const isRetryEligiblePendingOutgoingRequest = (params: Readonly<{
  requestStatus: RequestStatusSnapshot;
  evidence?: RequestFlowEvidence;
  nowUnixMs?: number;
  resendGraceMs?: number;
}>): boolean => {
  const { requestStatus, evidence } = params;
  if (!requestStatus?.isOutgoing) {
    return false;
  }
  if (requestStatus.status && requestStatus.status !== "pending") {
    return false;
  }
  if (evidence?.acceptSeen || evidence?.receiptAckSeen) {
    return false;
  }
  const ageMs = getPendingAgeMs(requestStatus, evidence, params.nowUnixMs ?? Date.now());
  if (typeof ageMs !== "number") {
    return true;
  }
  return ageMs >= (params.resendGraceMs ?? REQUEST_RESEND_GRACE_MS);
};

export const deriveRequestProjection = (params: Readonly<{
  requestStatus: RequestStatusSnapshot;
  evidence?: RequestFlowEvidence;
  nowUnixMs?: number;
  resendGraceMs?: number;
}>): RequestProjection => {
  const nowUnixMs = params.nowUnixMs ?? Date.now();
  const ageMs = getPendingAgeMs(params.requestStatus, params.evidence, nowUnixMs);

  if (params.requestStatus?.status === "accepted" || params.evidence?.acceptSeen) {
    return { state: "accepted", canSend: false, shouldDisablePrimaryAction: true, ageMs };
  }

  if (params.requestStatus?.status === "declined" || params.requestStatus?.status === "canceled") {
    return { state: "rejected", canSend: true, shouldDisablePrimaryAction: false, ageMs };
  }

  if (params.requestStatus?.status === "pending" && !params.requestStatus.isOutgoing) {
    return { state: "incoming_pending", canSend: false, shouldDisablePrimaryAction: true, ageMs };
  }

  if (params.requestStatus?.isOutgoing && (params.requestStatus.status === "pending" || !params.requestStatus.status)) {
    if (params.evidence?.receiptAckSeen) {
      return { state: "recipient_seen", canSend: true, shouldDisablePrimaryAction: false, ageMs };
    }
    if (isRetryEligiblePendingOutgoingRequest({
      requestStatus: params.requestStatus,
      evidence: params.evidence,
      nowUnixMs,
      resendGraceMs: params.resendGraceMs,
      })) {
      return { state: "retry_available", canSend: true, shouldDisablePrimaryAction: false, ageMs };
    }
    return { state: "sent_waiting", canSend: true, shouldDisablePrimaryAction: false, ageMs };
  }

  return { state: "none", canSend: true, shouldDisablePrimaryAction: false, ageMs };
};
