import type { Conversation, Message } from "@/app/features/messaging/types";
import { isGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";

type NotificationTarget = Readonly<
  | {
    kind: "dm";
    peerPublicKeyHex: string;
  }
  | {
    kind: "group";
    conversationId: string;
    groupId?: string;
  }
>;

const NOTIFICATION_TARGETS_DM_PREFIX = "dweb.nostr.pwa.notifications.targets.dm.";
const NOTIFICATION_TARGETS_GROUP_PREFIX = "dweb.nostr.pwa.notifications.targets.group.";
const LEGACY_GROUP_NOTIFICATIONS_KEY_PREFIX = "obscur_group_notifications_";
const NOTIFICATION_TARGET_PREFERENCE_CHANGED_EVENT = "obscur:notification-target-preference-changed";

const parseStoredPreferenceValue = (value: string | null): boolean | null => {
  if (value === null) {
    return null;
  }
  if (value === "1" || value === "on" || value === "true") {
    return true;
  }
  if (value === "0" || value === "off" || value === "false") {
    return false;
  }
  return null;
};

const getNotificationTargetStorageKey = (target: NotificationTarget): string => {
  if (target.kind === "dm") {
    return getScopedStorageKey(`${NOTIFICATION_TARGETS_DM_PREFIX}${target.peerPublicKeyHex}`);
  }
  return getScopedStorageKey(`${NOTIFICATION_TARGETS_GROUP_PREFIX}${target.conversationId}`);
};

const toLegacyGroupStorageKey = (groupId: string): string => (
  `${LEGACY_GROUP_NOTIFICATIONS_KEY_PREFIX}${groupId}`
);

const getGroupLegacyPreference = (groupId: string): boolean | null => {
  const scoped = parseStoredPreferenceValue(
    window.localStorage.getItem(getScopedStorageKey(toLegacyGroupStorageKey(groupId)))
  );
  if (scoped !== null) {
    return scoped;
  }
  return parseStoredPreferenceValue(window.localStorage.getItem(toLegacyGroupStorageKey(groupId)));
};

const dispatchPreferenceChanged = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(NOTIFICATION_TARGET_PREFERENCE_CHANGED_EVENT));
};

const toNotificationTarget = (conversation: Conversation): NotificationTarget => {
  if (conversation.kind === "dm") {
    return {
      kind: "dm",
      peerPublicKeyHex: conversation.pubkey,
    };
  }
  return {
    kind: "group",
    conversationId: conversation.id,
    groupId: conversation.groupId,
  };
};

const getNotificationTargetEnabled = (target: NotificationTarget): boolean => {
  if (typeof window === "undefined") {
    return true;
  }

  const scopedValue = parseStoredPreferenceValue(
    window.localStorage.getItem(getNotificationTargetStorageKey(target))
  );
  if (scopedValue !== null) {
    return scopedValue;
  }

  if (target.kind === "group") {
    const fallbackGroupId = target.groupId?.trim();
    if (fallbackGroupId) {
      const legacyValue = getGroupLegacyPreference(fallbackGroupId);
      if (legacyValue !== null) {
        return legacyValue;
      }
    }
  }

  return true;
};

const setNotificationTargetEnabled = (
  params: Readonly<{ target: NotificationTarget; enabled: boolean }>
): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    getNotificationTargetStorageKey(params.target),
    params.enabled ? "1" : "0"
  );

  if (params.target.kind === "group") {
    const fallbackGroupId = params.target.groupId?.trim();
    if (fallbackGroupId) {
      window.localStorage.setItem(
        getScopedStorageKey(toLegacyGroupStorageKey(fallbackGroupId)),
        params.enabled ? "on" : "off"
      );
    }
  }

  dispatchPreferenceChanged();
};

const isConversationNotificationsEnabled = (conversation: Conversation): boolean => (
  getNotificationTargetEnabled(toNotificationTarget(conversation))
);

const setConversationNotificationsEnabled = (
  params: Readonly<{ conversation: Conversation; enabled: boolean }>
): void => {
  setNotificationTargetEnabled({
    target: toNotificationTarget(params.conversation),
    enabled: params.enabled,
  });
};

const isMessageNotificationEnabledForIncomingEvent = (
  params: Readonly<{ conversationId: string; message: Message }>
): boolean => {
  if (isGroupConversationId(params.conversationId)) {
    return getNotificationTargetEnabled({
      kind: "group",
      conversationId: params.conversationId,
    });
  }
  const senderPubkey = params.message.senderPubkey?.trim();
  if (!senderPubkey) {
    return true;
  }
  return getNotificationTargetEnabled({
    kind: "dm",
    peerPublicKeyHex: senderPubkey,
  });
};

const isNotificationTargetPreferenceStorageKey = (key: string | null): boolean => {
  if (!key) {
    return false;
  }
  return (
    key.includes(NOTIFICATION_TARGETS_DM_PREFIX)
    || key.includes(NOTIFICATION_TARGETS_GROUP_PREFIX)
    || key.includes(LEGACY_GROUP_NOTIFICATIONS_KEY_PREFIX)
  );
};

const subscribeNotificationTargetPreferenceChanges = (
  listener: () => void
): (() => void) => {
  if (typeof window === "undefined") {
    return () => {
      return;
    };
  }
  const onStorage = (event: StorageEvent): void => {
    if (!isNotificationTargetPreferenceStorageKey(event.key)) {
      return;
    }
    listener();
  };
  const onCustomChange = (): void => {
    listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(NOTIFICATION_TARGET_PREFERENCE_CHANGED_EVENT, onCustomChange);
  return (): void => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(NOTIFICATION_TARGET_PREFERENCE_CHANGED_EVENT, onCustomChange);
  };
};

export {
  getNotificationTargetEnabled,
  isConversationNotificationsEnabled,
  isMessageNotificationEnabledForIncomingEvent,
  setConversationNotificationsEnabled,
  setNotificationTargetEnabled,
  subscribeNotificationTargetPreferenceChanges,
};

export type { NotificationTarget };
