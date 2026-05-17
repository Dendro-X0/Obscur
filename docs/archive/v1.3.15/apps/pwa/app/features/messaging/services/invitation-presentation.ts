import type { ContactRequestRecord } from "@/app/features/search/types/discovery";
import type { ConnectionRequestStatusValue } from "@/app/features/messaging/types";
import type { RequestTransportStatus } from "./request-flow-contracts";

export type InvitationTone = "neutral" | "info" | "success" | "warning" | "danger";

export type InvitationStatusCopy = Readonly<{
  badge: string;
  title: string;
  detail: string;
  tone: InvitationTone;
}>;

type DirectInvitationPhase = RequestTransportStatus | "sending" | "idle";
type DirectInvitationTerminalPhase = Exclude<DirectInvitationPhase, "idle" | "sending"> | "unsupported";

export type InvitationToastCopy = Readonly<{
  message: string;
  tone: Extract<InvitationTone, "success" | "warning" | "danger">;
}>;

const formatRetryDelay = (retryAtUnixMs: number, nowUnixMs: number): string => {
  const seconds = Math.max(1, Math.ceil((retryAtUnixMs - nowUnixMs) / 1000));
  if (seconds < 60) {
    return `about ${seconds}s`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `about ${minutes}m`;
};

export const getDirectInvitationStatusCopy = (
  phase: DirectInvitationPhase,
  options?: Readonly<{
    relaySuccessCount?: number;
    relayTotal?: number;
    message?: string | null;
  }>
): InvitationStatusCopy | null => {
  switch (phase) {
    case "idle":
      return null;
    case "sending":
      return {
        badge: "Sending invitation",
        title: "Obscur is trying to deliver your invitation now.",
        detail: "You will only see success after relays acknowledge it.",
        tone: "info",
      };
    case "ok":
      return {
        badge: "Invitation delivered",
        title: "Your invitation reached the network.",
        detail: "Now Obscur will wait for the other person to accept it.",
        tone: "success",
      };
    case "partial":
      return {
        badge: "Partially delivered",
        title: "Your invitation reached some relays, but not all of them.",
        detail: options?.relaySuccessCount && options?.relayTotal
          ? `Relay delivery: ${options.relaySuccessCount}/${options.relayTotal}. Keep the app online so Obscur can improve delivery.`
          : "Keep the app online so Obscur can improve delivery.",
        tone: "warning",
      };
    case "queued":
      return {
        badge: "Waiting for connection",
        title: "Obscur could not finish delivery yet.",
        detail: options?.message || "It will retry when your relay connection looks healthier.",
        tone: "warning",
      };
    case "unsupported":
    case "failed":
      return {
        badge: "Delivery failed",
        title: "This invitation was not confirmed by the network.",
        detail: options?.message || "Check relay health and try again.",
        tone: "danger",
      };
    default:
      return null;
  }
};

export const getDirectInvitationToastCopy = (
  phase: DirectInvitationTerminalPhase,
  options?: Readonly<{
    relaySuccessCount?: number;
    relayTotal?: number;
    message?: string | null;
  }>
): InvitationToastCopy => {
  switch (phase) {
    case "ok":
      return {
        message: "Invitation delivered.",
        tone: "success",
      };
    case "partial":
      return {
        message: options?.relaySuccessCount && options?.relayTotal
          ? `Invitation partially delivered (${options.relaySuccessCount}/${options.relayTotal}).`
          : "Invitation partially delivered.",
        tone: "warning",
      };
    case "queued":
      return {
        message: "Invitation queued for retry.",
        tone: "warning",
      };
    case "unsupported":
    case "failed":
    default:
      return {
        message: options?.message || "Invitation delivery failed.",
        tone: "danger",
      };
  }
};

const getFailedInvitationDetail = (record: ContactRequestRecord, nowUnixMs: number): string => {
  if (record.blockReason === "cooldown_active") {
    return "You recently tried this contact. Wait for the cooldown, then try again.";
  }
  if (record.blockReason === "pending_request_exists") {
    return "Obscur already has an active invitation for this person.";
  }
  if (record.blockReason === "already_connected" || record.blockReason === "already_accepted") {
    return "You are already connected with this person.";
  }
  if (record.blockReason === "peer_blocked") {
    return "This person is blocked, so Obscur will not send another invitation.";
  }
  if (record.nextRetryAtUnixMs && record.nextRetryAtUnixMs > nowUnixMs) {
    return `Obscur will retry automatically in ${formatRetryDelay(record.nextRetryAtUnixMs, nowUnixMs)}.`;
  }
  return record.error || "Obscur could not confirm delivery. You can retry after checking your relay connection.";
};

export const getInvitationOutboxStatusCopy = (
  record: ContactRequestRecord,
  nowUnixMs = Date.now()
): InvitationStatusCopy => {
  switch (record.status) {
    case "draft":
      return {
        badge: "Draft",
        title: "This invitation is still being prepared.",
        detail: "Finish the note, then send when you are ready.",
        tone: "neutral",
      };
    case "queued":
      return {
        badge: "Waiting to send",
        title: "Obscur is holding this invitation until a relay is writable.",
        detail: "Keep the app online and it will retry automatically.",
        tone: "info",
      };
    case "publishing":
      return {
        badge: "Sending now",
        title: "Obscur is delivering this invitation right now.",
        detail: "Success is only shown after relay acknowledgement.",
        tone: "info",
      };
    case "sent_partial":
      return {
        badge: "Partially delivered",
        title: "The invitation reached some relays.",
        detail: record.publishReport
          ? `Relay delivery: ${record.publishReport.successCount}/${record.publishReport.totalRelays}.`
          : "Keep the app online while delivery catches up.",
        tone: "warning",
      };
    case "sent_quorum":
      return {
        badge: "Invitation sent",
        title: "The network accepted this invitation.",
        detail: "Now Obscur is waiting for the other person to respond.",
        tone: "success",
      };
    case "accepted":
      return {
        badge: "Accepted",
        title: "This person accepted your invitation.",
        detail: "You can move into messaging now.",
        tone: "success",
      };
    case "rejected":
      return {
        badge: "Not accepted",
        title: "This invitation was declined or canceled.",
        detail: "You can try again later with a clearer intro if that makes sense.",
        tone: "danger",
      };
    case "expired":
      return {
        badge: "Expired",
        title: "This invitation is too old to keep retrying.",
        detail: "Send a fresh invitation if you still want to connect.",
        tone: "danger",
      };
    case "failed":
    default:
      return {
        badge: "Needs attention",
        title: "Obscur could not confirm delivery for this invitation.",
        detail: getFailedInvitationDetail(record, nowUnixMs),
        tone: "danger",
      };
  }
};

export const getInvitationInboxStatusCopy = (
  status: ConnectionRequestStatusValue | undefined,
  isOutgoing = false
): InvitationStatusCopy => {
  if (isOutgoing) {
    switch (status) {
      case "accepted":
        return {
          badge: "Accepted",
          title: "Your invitation was accepted.",
          detail: "This connection is ready for conversation.",
          tone: "success",
        };
      case "declined":
        return {
          badge: "Declined",
          title: "Your invitation was not accepted.",
          detail: "You can try again later if it still makes sense.",
          tone: "danger",
        };
      case "canceled":
        return {
          badge: "Canceled",
          title: "This outgoing invitation is no longer active.",
          detail: "Obscur stopped treating it as an open connection request.",
          tone: "danger",
        };
      case "pending":
      default:
        return {
          badge: "Invitation sent",
          title: "Obscur is waiting for their response.",
          detail: "You do not need to accept your own invitation.",
          tone: "info",
        };
    }
  }

  switch (status) {
    case "accepted":
      return {
        badge: "Accepted",
        title: "You accepted this invitation.",
        detail: "This connection is ready for conversation.",
        tone: "success",
      };
    case "declined":
      return {
        badge: "Ignored",
        title: "You chose not to accept this invitation.",
        detail: "Obscur will keep the history quiet unless you revisit it.",
        tone: "danger",
      };
    case "canceled":
      return {
        badge: "Canceled",
        title: "This invitation is no longer active.",
        detail: "The sender canceled it or delivery could not be maintained.",
        tone: "danger",
      };
    case "pending":
    default:
      return {
        badge: "New invitation",
        title: "Someone wants to connect with you.",
        detail: "Read their note, then decide whether to accept, ignore, or block.",
        tone: "info",
      };
  }
};
