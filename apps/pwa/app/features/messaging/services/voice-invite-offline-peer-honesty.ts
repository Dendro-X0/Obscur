/**
 * Presence is soft — do not hard-block dial, but warn when peer looks offline.
 */

export const shouldWarnOfflinePeerBeforeVoiceInviteDial = (params: Readonly<{
  peerIsOnline: boolean | null | undefined;
}>): boolean => params.peerIsOnline === false;
