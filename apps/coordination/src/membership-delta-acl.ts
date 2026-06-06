import type { MembershipDeltaAction, MembershipDeltaBody } from "./membership-directory";

export type MembershipDeltaAclRow = Readonly<{
  seq: number;
  action: MembershipDeltaAction;
  subjectPubkey: string;
  actorPubkey: string;
}>;

export type MembershipDeltaAclDecision = Readonly<
  | { allowed: true }
  | { allowed: false; error: string }
>;

const normalizePubkey = (pubkey: string): string => pubkey.trim().toLowerCase();

const foldMembershipSets = (
  deltas: ReadonlyArray<MembershipDeltaAclRow>,
): Readonly<{
  active: Set<string>;
  left: Set<string>;
  expelled: Set<string>;
  bootstrapStewardPubkey: string | null;
}> => {
  const active = new Set<string>();
  const left = new Set<string>();
  const expelled = new Set<string>();
  let bootstrapStewardPubkey: string | null = null;

  deltas.forEach((delta) => {
    if (delta.seq === 1 && delta.action === "join" && !bootstrapStewardPubkey) {
      bootstrapStewardPubkey = normalizePubkey(delta.subjectPubkey);
    }
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
  });

  return { active, left, expelled, bootstrapStewardPubkey };
};

/**
 * Path B Band B1 steward ACL — who may append membership deltas per community.
 *
 * - join: self-attested (`subject === actor`); rejects duplicate active and expelled re-join without leave.
 * - leave: self-attested only.
 * - expel: bootstrap steward (first join at seq 1) only; subject must be active.
 */
export const evaluateMembershipDeltaAcl = (params: Readonly<{
  existingDeltas: ReadonlyArray<MembershipDeltaAclRow>;
  delta: MembershipDeltaBody;
}>): MembershipDeltaAclDecision => {
  const subject = normalizePubkey(params.delta.subjectPubkey);
  const actor = normalizePubkey(params.delta.actorPubkey);
  if (!subject || !actor) {
    return { allowed: false, error: "invalid_pubkeys" };
  }

  const { active, expelled, bootstrapStewardPubkey } = foldMembershipSets(params.existingDeltas);

  if (params.delta.action === "join") {
    if (subject !== actor) {
      return { allowed: false, error: "join_requires_self_attestation" };
    }
    if (active.has(subject)) {
      return { allowed: false, error: "already_active" };
    }
    if (expelled.has(subject)) {
      return { allowed: false, error: "expelled_cannot_rejoin" };
    }
    return { allowed: true };
  }

  if (params.delta.action === "leave") {
    if (subject !== actor) {
      return { allowed: false, error: "leave_requires_self_attestation" };
    }
    if (!active.has(subject)) {
      return { allowed: false, error: "not_active" };
    }
    return { allowed: true };
  }

  if (subject === actor) {
    return { allowed: false, error: "expel_requires_different_subject" };
  }
  if (!bootstrapStewardPubkey || actor !== bootstrapStewardPubkey) {
    return { allowed: false, error: "expel_requires_bootstrap_steward" };
  }
  if (!active.has(subject)) {
    return { allowed: false, error: "expel_subject_not_active" };
  }
  return { allowed: true };
};
