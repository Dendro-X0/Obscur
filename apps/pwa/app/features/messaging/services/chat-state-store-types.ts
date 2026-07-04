/**
 * Chat state store contracts — event surface for replace notifications.
 */
export const CHAT_STATE_REPLACED_EVENT = "obscur:chat-state-replaced";

export type ChatStateReplacedEventDetail = Readonly<{
  publicKeyHex: string;
  profileId: string;
}>;
