import type { CommunityLeaveOutboxItem, CommunityLeavePublishStatus } from "./community-leave-outbox";

export type CommunityLeavePublishSurfaceCopy = Readonly<{
  status: CommunityLeavePublishStatus;
  title: string;
  detail: string;
  shortLabel: string;
}>;

const formatRetryAfter = (retryAfterUnixMs: number | undefined, nowUnixMs: number): string | null => {
  if (retryAfterUnixMs === undefined) {
    return null;
  }
  const remainingMs = retryAfterUnixMs - nowUnixMs;
  if (remainingMs <= 0) {
    return "retrying now";
  }
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return `retry in ~${minutes} min`;
};

export const resolveCommunityLeavePublishSurfaceCopy = (
  item: CommunityLeaveOutboxItem,
  nowUnixMs: number = Date.now(),
): CommunityLeavePublishSurfaceCopy => {
  if (item.status === "rejected") {
    const reason = item.rejectedReasonCode?.trim();
    return {
      status: item.status,
      title: "Leave saved locally — relay declined",
      detail: reason
        ? `Your device recorded the leave, but the relay rejected confirmation (${reason}). You are not joined here locally.`
        : "Your device recorded the leave, but the relay did not accept confirmation. You are not joined here locally.",
      shortLabel: "Relay declined",
    };
  }

  if (item.status === "rate_limited") {
    const retryHint = formatRetryAfter(item.retryAfterUnixMs, nowUnixMs);
    return {
      status: item.status,
      title: "Leave saved locally — relay rate limited",
      detail: retryHint
        ? `Confirmation is queued and will ${retryHint}. You are not joined here locally.`
        : "Confirmation is queued; the app will retry when the relay allows.",
      shortLabel: "Relay retry",
    };
  }

  return {
    status: item.status,
    title: "Leave saved locally — confirming on relay",
    detail: "You are not joined here on this device. Relay confirmation will retry in the background.",
    shortLabel: "Relay pending",
  };
};

export const isCommunityLeaveOutboxAwaitingRelay = (
  item: CommunityLeaveOutboxItem | null | undefined,
): item is CommunityLeaveOutboxItem => Boolean(item && item.status !== "published");
