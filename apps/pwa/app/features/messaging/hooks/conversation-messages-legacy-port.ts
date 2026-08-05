/**
 * R1-delete — legacy UI hydrate port tombstone.
 * Thick conversation-messages legacy hook deleted; product uses
 * useThreadMessages → dm-kernel | inert only.
 */

/** Always false — legacy UI hydrate tree removed. */
export const shouldUseLegacyConversationMessagesHydrate = (): boolean => false;
