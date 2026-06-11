/**
 * Tier 4 — bidirectional SQLite evidence gate for dm-kernel proof.
 * @see docs/program/obscur-v2-slim-kernel-manifest.md
 */

export type DmKernelSqliteMessageSnapshot = Readonly<{
  id: string;
  content: string;
  isOutgoing: boolean;
  status: string;
}>;

export type DmKernelBidirectionalGateResult = Readonly<{
  peerPublicKeyHex: string;
  total: number;
  outgoing: number;
  incoming: number;
  bidirectional: boolean;
  skipped: boolean;
  reason: string;
}>;

export const evaluateDmKernelBidirectionalSnapshots = (
  peerPublicKeyHex: string,
  snapshots: ReadonlyArray<DmKernelSqliteMessageSnapshot>,
): DmKernelBidirectionalGateResult => {
  const peer = peerPublicKeyHex.trim().toLowerCase();
  if (!peer) {
    return {
      peerPublicKeyHex: peerPublicKeyHex,
      total: 0,
      outgoing: 0,
      incoming: 0,
      bidirectional: false,
      skipped: true,
      reason: "missing_peer_pubkey",
    };
  }

  if (snapshots.length === 0) {
    return {
      peerPublicKeyHex: peer,
      total: 0,
      outgoing: 0,
      incoming: 0,
      bidirectional: false,
      skipped: true,
      reason: "no_sqlite_thread",
    };
  }

  let outgoing = 0;
  let incoming = 0;
  for (const row of snapshots) {
    if (row.isOutgoing) {
      outgoing += 1;
    } else {
      incoming += 1;
    }
  }

  const bidirectional = outgoing > 0 && incoming > 0;
  return {
    peerPublicKeyHex: peer,
    total: snapshots.length,
    outgoing,
    incoming,
    bidirectional,
    skipped: false,
    reason: bidirectional ? "bidirectional_ok" : "one_sided_thread",
  };
};
