/**
 * Cut 0.7 — pure H-dc outbox status mapping (home ACK honesty).
 * Home ACK → accepted only; never auto-delivered.
 * @see specs/backend/cut0-account-spine-design-2026-11-09.md §6
 * @see docs/exploration/feasibility/24-messaging-plane-skim.md
 */

export type HdcMessageStatus =
  | "sending"
  | "queued"
  | "accepted"
  | "rejected"
  | "delivered"
  | "failed";

export const HDC_MESSAGE_STATUSES: ReadonlyArray<HdcMessageStatus> = [
  "sending",
  "queued",
  "accepted",
  "rejected",
  "delivered",
  "failed",
];

const VALID_TRANSITIONS: Readonly<Record<HdcMessageStatus, ReadonlyArray<HdcMessageStatus>>> = {
  sending: ["accepted", "rejected", "queued", "failed"],
  queued: ["sending", "failed"],
  accepted: ["delivered"],
  rejected: ["queued", "failed"],
  delivered: [],
  failed: ["queued", "sending"],
};

export const isValidHdcStatusTransition = (
  from: HdcMessageStatus,
  to: HdcMessageStatus,
): boolean => VALID_TRANSITIONS[from].includes(to);

/**
 * Map thin H-dc home ACK / wire status → local status.
 * Explicitly refuses `delivered` from home OK.
 */
export const mapHomeAckToStatus = (
  wireStatus?: string | null,
): HdcMessageStatus => {
  if (wireStatus === "rejected" || wireStatus === "failed") {
    return wireStatus;
  }
  // sent / delivered / accepted / missing → accepted (home saw the blob)
  return "accepted";
};

export const assertHomeAckNotDelivered = (status: HdcMessageStatus): void => {
  if (status === "delivered") {
    throw new Error("hdc_home_ack_must_not_be_delivered");
  }
};
