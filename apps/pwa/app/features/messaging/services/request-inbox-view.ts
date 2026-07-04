import type { RequestsInboxItem } from "../types";
import { classifyIncomingRequestInboxLane } from "./classify-incoming-request-inbox-lane";

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

export const partitionIncomingRequestsByLane = (
  items: ReadonlyArray<RequestsInboxItem>,
  params?: Readonly<{ nowUnixMs?: number }>,
): Readonly<{ inbox: ReadonlyArray<RequestsInboxItem>; junk: ReadonlyArray<RequestsInboxItem> }> => {
  const inbox: RequestsInboxItem[] = [];
  const junk: RequestsInboxItem[] = [];
  for (const item of getIncomingInboxRequests(items)) {
    if (classifyIncomingRequestInboxLane({ item, nowUnixMs: params?.nowUnixMs }) === "junk") {
      junk.push(item);
      continue;
    }
    inbox.push(item);
  }
  return { inbox, junk };
};

export const getIncomingLaneUnreadTotal = (
  items: ReadonlyArray<RequestsInboxItem>,
): number => (
  items.reduce((sum, item) => sum + item.unreadCount, 0)
);

export const getIncomingLanePendingCount = (
  items: ReadonlyArray<RequestsInboxItem>,
): number => items.length;
