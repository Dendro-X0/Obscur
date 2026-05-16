import type { Conversation, Message } from "@/app/features/messaging/types";
import { isGroupConversationId } from "@/app/features/groups/utils/group-conversation-id";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getProfileRuntimeScope, getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

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
/** Historical name for cross-tab/tests; runtime uses {@link ProfileMessageBus} `notification-target-preference-changed` only. */
export const NOTIFICATION_TARGET_PREFERENCE_CHANGED_EVENT = "obscur:notification-target-preference-changed";

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

const resolvePreferenceProfileId = (profileId?: string): string => (
  profileId ?? getResolvedProfileId()
);

const getNotificationTargetStorageKey = (target: NotificationTarget, profileId?: string): string => {
  const scopeId = resolvePreferenceProfileId(profileId);
  if (target.kind === "dm") {
    return getScopedStorageKey(`${NOTIFICATION_TARGETS_DM_PREFIX}${target.peerPublicKeyHex}`, scopeId);
  }
  return getScopedStorageKey(`${NOTIFICATION_TARGETS_GROUP_PREFIX}${target.conversationId}`, scopeId);
};

const toLegacyGroupStorageKey = (groupId: string): string => (
  `${LEGACY_GROUP_NOTIFICATIONS_KEY_PREFIX}${groupId}`
);

const getGroupLegacyPreference = (groupId: string, profileId?: string): boolean | null => {
  const scopeId = resolvePreferenceProfileId(profileId);
  const scoped = parseStoredPreferenceValue(
    window.localStorage.getItem(getScopedStorageKey(toLegacyGroupStorageKey(groupId), scopeId))
  );
  if (scoped !== null) {
    return scoped;
  }
  return parseStoredPreferenceValue(window.localStorage.getItem(toLegacyGroupStorageKey(groupId)));
};

const dispatchPreferenceChanged = (): void => {
  getProfileRuntimeScope()?.bus.publish({ type: "notification-target-preference-changed" });
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

const getNotificationTargetEnabled = (target: NotificationTarget, profileId?: string): boolean => {
  if (typeof window === "undefined") {
    return true;
  }

  const scopedValue = parseStoredPreferenceValue(
    window.localStorage.getItem(getNotificationTargetStorageKey(target, profileId))
  );
  if (scopedValue !== null) {
    return scopedValue;
  }

  if (target.kind === "group") {
    const fallbackGroupId = target.groupId?.trim();
    if (fallbackGroupId) {
      const legacyValue = getGroupLegacyPreference(fallbackGroupId, profileId);
      if (legacyValue !== null) {
        return legacyValue;
      }
    }
  }

  return true;
};

const setNotificationTargetEnabled = (
  params: Readonly<{ target: NotificationTarget; enabled: boolean; profileId?: string }>
): void => {
  if (typeof window === "undefined") {
    return;
  }
  const scopeId = resolvePreferenceProfileId(params.profileId);
  window.localStorage.setItem(
    getNotificationTargetStorageKey(params.target, scopeId),
    params.enabled ? "1" : "0"
  );

  if (params.target.kind === "group") {
    const fallbackGroupId = params.target.groupId?.trim();
    if (fallbackGroupId) {
      window.localStorage.setItem(
        getScopedStorageKey(toLegacyGroupStorageKey(fallbackGroupId), scopeId),
        params.enabled ? "on" : "off"
      );
    }
  }

  dispatchPreferenceChanged();
};

const isConversationNotificationsEnabled = (conversation: Conversation, profileId?: string): boolean => (
  getNotificationTargetEnabled(toNotificationTarget(conversation), profileId)
);

const setConversationNotificationsEnabled = (
  params: Readonly<{ conversation: Conversation; enabled: boolean; profileId?: string }>
): void => {
  setNotificationTargetEnabled({
    target: toNotificationTarget(params.conversation),
    enabled: params.enabled,
    profileId: params.profileId,
  });
};

const isMessageNotificationEnabledForIncomingEvent = (
  params: Readonly<{ conversationId: string; message: Message; profileId?: string }>
): boolean => {
  if (isGroupConversationId(params.conversationId)) {
    return getNotificationTargetEnabled({
      kind: "group",
      conversationId: params.conversationId,
    }, params.profileId);
  }
  const senderPubkey = params.message.senderPubkey?.trim();
  if (!senderPubkey) {
    return true;
  }
  return getNotificationTargetEnabled({
    kind: "dm",
    peerPublicKeyHex: senderPubkey,
  }, params.profileId);
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

/** Storage keys with `::profile` suffix only notify listeners for that profile; legacy keys without `::` notify all (cross-tab compat). */
const storageKeyMatchesNotificationPreferenceScope = (key: string | null, profileId: string): boolean => {
  if (!isNotificationTargetPreferenceStorageKey(key) || !key) {
    return false;
  }
  if (key.includes("::")) {
    return key.endsWith(`::${profileId}`);
  }
  return true;
};

const subscribeNotificationTargetPreferenceChanges = (
  listener: () => void,
  profileId?: string
): (() => void) => {
  if (typeof window === "undefined") {
    return () => {
      return;
    };
  }
  const resolvedProfileId = resolvePreferenceProfileId(profileId);
  const onStorage = (event: StorageEvent): void => {
    if (!storageKeyMatchesNotificationPreferenceScope(event.key, resolvedProfileId)) {
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
