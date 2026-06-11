"use client";

export type GroupThreadMessagesChangedDetail = Readonly<{
  conversationId: string;
  profileId: string;
  groupId: string;
  atUnixMs: number;
}>;

const GROUP_THREAD_MESSAGES_CHANGED_EVENT = "obscur:group-thread-messages-changed";

export const dispatchGroupThreadMessagesChanged = (
  detail: Readonly<{
    conversationId: string;
    profileId: string;
    groupId: string;
    atUnixMs?: number;
  }>,
): void => {
  if (typeof window === "undefined") {
    return;
  }
  const payload: GroupThreadMessagesChangedDetail = {
    conversationId: detail.conversationId.trim(),
    profileId: detail.profileId.trim(),
    groupId: detail.groupId.trim(),
    atUnixMs: detail.atUnixMs ?? Date.now(),
  };
  if (!payload.conversationId || !payload.profileId || !payload.groupId) {
    return;
  }
  window.dispatchEvent(new CustomEvent(GROUP_THREAD_MESSAGES_CHANGED_EVENT, { detail: payload }));
};

export const subscribeGroupThreadMessagesChanged = (
  handler: (detail: GroupThreadMessagesChangedDetail) => void,
): (() => void) => {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const listener = (event: Event): void => {
    const detail = (event as CustomEvent<GroupThreadMessagesChangedDetail>).detail;
    if (!detail?.conversationId?.trim()) {
      return;
    }
    handler(detail);
  };
  window.addEventListener(GROUP_THREAD_MESSAGES_CHANGED_EVENT, listener);
  return () => window.removeEventListener(GROUP_THREAD_MESSAGES_CHANGED_EVENT, listener);
};
