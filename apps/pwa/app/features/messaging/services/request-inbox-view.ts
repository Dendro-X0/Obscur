import type { RequestsInboxItem } from "../types";
import { classifyIncomingRequestInboxLane } from "./classify-incoming-request-inbox-lane";

const isPendingRequestStatus = (status: RequestsInboxItem["status"]): boolean => (
  !status || status === "pending"
);

export const isIncomingPendingRequest = (item: RequestsInboxItem): boolean => {
  return !item.isOutgoing && isPendingRequestStatus(item.status);
};

export const isOutgoingPendingRequest = (item: RequestsInboxItem): boolean => {
  return !!item.isOutgoing && isPendingRequestStatus(item.status);
};

export const isOutgoingResendableRequest = (item: RequestsInboxItem): boolean => (
  !!item.isOutgoing && (item.status === "declined" || item.status === "canceled")
);

export const isOpenPendingRequest = (item: RequestsInboxItem): boolean => (
  isIncomingPendingRequest(item) || isOutgoingPendingRequest(item)
);

/** Pending plus outgoing terminal rows that can be retried from the Requests tab. */
export const isRequestsTabItem = (item: RequestsInboxItem): boolean => (
  isOpenPendingRequest(item) || isOutgoingResendableRequest(item)
);

export const getIncomingInboxRequests = (
  items: ReadonlyArray<RequestsInboxItem>
): ReadonlyArray<RequestsInboxItem> => {
  return items.filter(isIncomingPendingRequest);
};

/** Incoming + outgoing pending rows for the Requests tab (ASE-1d). */
export const getOpenPendingRequests = (
  items: ReadonlyArray<RequestsInboxItem>,
): ReadonlyArray<RequestsInboxItem> => items.filter(isOpenPendingRequest);

export const getRequestsTabItems = (
  items: ReadonlyArray<RequestsInboxItem>,
): ReadonlyArray<RequestsInboxItem> => items.filter(isRequestsTabItem);

export const getIncomingPendingRequestCount = (
  items: ReadonlyArray<RequestsInboxItem>
): number => {
  return items.filter(isIncomingPendingRequest).length;
};

export const getOpenPendingRequestCount = (
  items: ReadonlyArray<RequestsInboxItem>,
): number => getOpenPendingRequests(items).length;

export const getIncomingUnreadRequestTotal = (
  items: ReadonlyArray<RequestsInboxItem>
): number => {
  return items
    .filter((item) => !item.isOutgoing)
    .reduce((sum, item) => sum + item.unreadCount, 0);
};

/** Partition open pending requests: outgoing always in inbox; incoming split inbox/junk. */
export const partitionOpenRequestsByLane = (
  items: ReadonlyArray<RequestsInboxItem>,
  params?: Readonly<{ nowUnixMs?: number }>,
): Readonly<{ inbox: ReadonlyArray<RequestsInboxItem>; junk: ReadonlyArray<RequestsInboxItem> }> => {
  const inbox: RequestsInboxItem[] = [];
  const junk: RequestsInboxItem[] = [];
  for (const item of items) {
    if (isOutgoingPendingRequest(item) || isOutgoingResendableRequest(item)) {
      inbox.push(item);
      continue;
    }
    if (!isIncomingPendingRequest(item)) {
      continue;
    }
    if (classifyIncomingRequestInboxLane({ item, nowUnixMs: params?.nowUnixMs }) === "junk") {
      junk.push(item);
      continue;
    }
    inbox.push(item);
  }
  return { inbox, junk };
};

/** @deprecated Use partitionOpenRequestsByLane — kept for contract tests. */
export const partitionIncomingRequestsByLane = (
  items: ReadonlyArray<RequestsInboxItem>,
  params?: Readonly<{ nowUnixMs?: number }>,
): Readonly<{ inbox: ReadonlyArray<RequestsInboxItem>; junk: ReadonlyArray<RequestsInboxItem> }> => (
  partitionOpenRequestsByLane(items, params)
);

export const getIncomingLaneUnreadTotal = (
  items: ReadonlyArray<RequestsInboxItem>,
): number => (
  items.reduce((sum, item) => sum + item.unreadCount, 0)
);

export const getIncomingLanePendingCount = (
  items: ReadonlyArray<RequestsInboxItem>,
): number => items.length;
