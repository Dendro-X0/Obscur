import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CoordinationMembershipDeltaRecord } from "./community-coordination-membership-client";

export type CoordinationMembershipMaterialization = Readonly<{
  activeMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  leftMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  expelledMemberPubkeys: ReadonlyArray<PublicKeyHex>;
  headSeq: number;
}>;

const normalizePubkey = (pubkey: string): string => pubkey.trim().toLowerCase();

const dedupePubkeys = (pubkeys: ReadonlyArray<string>): ReadonlyArray<PublicKeyHex> => {
  const seen = new Set<string>();
  const out: PublicKeyHex[] = [];
  pubkeys.forEach((pubkey) => {
    const normalized = normalizePubkey(pubkey);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    out.push(normalized as PublicKeyHex);
  });
  return out;
};

export const createEmptyCoordinationMembershipMaterialization = (): CoordinationMembershipMaterialization => ({
  activeMemberPubkeys: [],
  leftMemberPubkeys: [],
  expelledMemberPubkeys: [],
  headSeq: 0,
});

/** Fold signed coordination deltas into authoritative active/terminal sets. */
export const materializeCoordinationMembershipFromDeltas = (
  deltas: ReadonlyArray<CoordinationMembershipDeltaRecord>,
): CoordinationMembershipMaterialization => {
  const active = new Set<string>();
  const left = new Set<string>();
  const expelled = new Set<string>();
  let headSeq = 0;

  deltas.forEach((delta) => {
    headSeq = Math.max(headSeq, delta.seq);
    applyDeltaToSets(active, left, expelled, delta);
  });

  return {
    activeMemberPubkeys: dedupePubkeys(Array.from(active)),
    leftMemberPubkeys: dedupePubkeys(Array.from(left)),
    expelledMemberPubkeys: dedupePubkeys(Array.from(expelled)),
    headSeq,
  };
};

const applyDeltaToSets = (
  active: Set<string>,
  left: Set<string>,
  expelled: Set<string>,
  delta: CoordinationMembershipDeltaRecord,
): void => {
  const subject = normalizePubkey(delta.subjectPubkey);
  if (!subject) {
    return;
  }
  if (delta.action === "join") {
    left.delete(subject);
    expelled.delete(subject);
    active.add(subject);
    return;
  }
  active.delete(subject);
  if (delta.action === "leave") {
    left.add(subject);
    expelled.delete(subject);
    return;
  }
  expelled.add(subject);
  left.delete(subject);
};

export const applyCoordinationMembershipDeltaToMaterialization = (
  current: CoordinationMembershipMaterialization,
  delta: CoordinationMembershipDeltaRecord,
): CoordinationMembershipMaterialization => {
  if (delta.seq <= current.headSeq) {
    return current;
  }
  const active = new Set(current.activeMemberPubkeys.map(normalizePubkey));
  const left = new Set(current.leftMemberPubkeys.map(normalizePubkey));
  const expelled = new Set(current.expelledMemberPubkeys.map(normalizePubkey));
  applyDeltaToSets(active, left, expelled, delta);
  return {
    activeMemberPubkeys: dedupePubkeys(Array.from(active)),
    leftMemberPubkeys: dedupePubkeys(Array.from(left)),
    expelledMemberPubkeys: dedupePubkeys(Array.from(expelled)),
    headSeq: delta.seq,
  };
};

export const applyCoordinationMembershipDeltasToMaterialization = (
  current: CoordinationMembershipMaterialization,
  deltas: ReadonlyArray<CoordinationMembershipDeltaRecord>,
): CoordinationMembershipMaterialization => (
  deltas.reduce(
    (state, delta) => applyCoordinationMembershipDeltaToMaterialization(state, delta),
    current,
  )
);
