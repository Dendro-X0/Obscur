import type { RequestsInboxItem } from "@/app/features/messaging/types";

/** Plain DM lines mistaken for requests by legacy orphan backfill (not connection-request traffic). */
export const isLikelyPlainDmOrphanRequest = (
  item: RequestsInboxItem,
): boolean => {
  if (item.isOutgoing || item.eventId?.trim()) {
    return false;
  }
  const status = item.status ?? "pending";
  if (status !== "pending") {
    return false;
  }
  if (item.isRequest !== true) {
    return false;
  }
  const preview = item.lastMessagePreview.trim();
  if (!preview) {
    return false;
  }
  if (preview.length > 96) {
    return false;
  }
  return !/(connect|invitation|invit|request|obscur|hello)/i.test(preview);
};

/** DM contact-request rows only — excludes plain stranger threads misclassified as pending requests. */
export const isCanonicalContactRequestInboxItem = (
  item: RequestsInboxItem,
): boolean => {
  if (isLikelyPlainDmOrphanRequest(item)) {
    return false;
  }
  if (item.status && item.status !== "pending") {
    return true;
  }
  if (item.isOutgoing) {
    return true;
  }
  return Boolean(item.eventId?.trim()) || item.isRequest === true;
};

export const filterCanonicalContactRequestInboxItems = (
  items: ReadonlyArray<RequestsInboxItem>,
): ReadonlyArray<RequestsInboxItem> => (
  items.filter(isCanonicalContactRequestInboxItem)
);
