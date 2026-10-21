/**
 * R3 — host dial/offer → connected elapsed helpers (diagnostics only).
 */

export const resolveRealtimeCallConnectedElapsedMs = (
  startedAtUnixMs: number | null | undefined,
  connectedAtUnixMs: number,
): number | null => {
  if (typeof startedAtUnixMs !== "number" || !Number.isFinite(startedAtUnixMs) || startedAtUnixMs <= 0) {
    return null;
  }
  if (!Number.isFinite(connectedAtUnixMs)) {
    return null;
  }
  return Math.max(0, Math.floor(connectedAtUnixMs - startedAtUnixMs));
};

export type RealtimeCallHostConnectedContext = Readonly<{
  roomIdHint: string;
  peerPubkeySuffix: string;
  dialToConnectedElapsedMs: number | null;
  offerToConnectedElapsedMs: number | null;
}>;

export const buildRealtimeCallHostConnectedContext = (params: Readonly<{
  roomIdHint: string;
  peerPubkeySuffix: string;
  dialStartedAtUnixMs: number | null | undefined;
  offerSentAtUnixMs: number | null | undefined;
  connectedAtUnixMs: number;
}>): RealtimeCallHostConnectedContext => ({
  roomIdHint: params.roomIdHint,
  peerPubkeySuffix: params.peerPubkeySuffix,
  dialToConnectedElapsedMs: resolveRealtimeCallConnectedElapsedMs(
    params.dialStartedAtUnixMs,
    params.connectedAtUnixMs,
  ),
  offerToConnectedElapsedMs: resolveRealtimeCallConnectedElapsedMs(
    params.offerSentAtUnixMs,
    params.connectedAtUnixMs,
  ),
});
