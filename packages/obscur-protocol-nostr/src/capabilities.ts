/**
 * P7b — Obscur-Nostr advertised capabilities (package body leaf).
 * Structural match to PAL ProtocolCapabilities; no app imports.
 */

export type ObscurNostrCapabilities = Readonly<{
  dms: boolean;
  groups: boolean;
  reactions: boolean;
  media: boolean;
}>;

/** Live Obscur-Nostr feature surface as exposed through ProtocolAdaptationLayer. */
export const OBSCUR_NOSTR_CAPABILITIES: ObscurNostrCapabilities = {
  dms: true,
  groups: true,
  reactions: true,
  media: true,
};

/** Canonical sendMessage port is not wired for credentialed Nostr DM — use sendDm. */
export const formatNostrCanonicalSendRequiresCredentialsError = (
  conversationId: string,
): string => (
  `NostrAdapter.sendMessage requires full DM credentials; use ProtocolAdaptationLayer.sendDm or nostrAdapter.sendDm (conversation=${conversationId.slice(0, 16)})`
);
