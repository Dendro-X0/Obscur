import type { RequestsInboxItem } from "../types";

export const isIncomingPendingRequest = (item: RequestsInboxItem): boolean => {
  return !item.isOutgoing && item.status === "pending";
};

export const isOutgoingPendingRequest = (item: RequestsInboxItem): boolean => {
  return !!item.isOutgoing && item.status === "pending";
};

export const getIncomingInboxRequests = (
  items: ReadonlyArray<RequestsInboxItem>
): ReadonlyArray<RequestsInboxItem> => {
  return items.filter(isIncomingPendingRequest);
};

export const getIncomingPendingRequestCount = (
  items: ReadonlyArray<RequestsInboxItem>
): number => {
  return items.filter(isIncomingPendingRequest).length;
};

export const getIncomingUnreadRequestTotal = (
  items: ReadonlyArray<RequestsInboxItem>
): number => {
  return items
    .filter((item) => !item.isOutgoing)
    .reduce((sum, item) => sum + item.unreadCount, 0);
};
