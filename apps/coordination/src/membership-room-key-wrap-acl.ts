import type { MembershipDeltaAclRow } from "./membership-delta-acl";
import { materializeMembershipSetsFromDeltas } from "./membership-delta-acl";

export type RoomKeyWrapAclDecision = Readonly<
  | { allowed: true }
  | { allowed: false; error: string }
>;

const normalizePubkey = (pubkey: string): string => pubkey.trim().toLowerCase();

/**
 * Path B Slice C — who may publish E2E room-key wraps.
 * - Self-wrap when subject is active.
 * - Bootstrap steward may wrap for any active member (invite path in C5).
 */
export const evaluateRoomKeyWrapAcl = (params: Readonly<{
  existingDeltas: ReadonlyArray<MembershipDeltaAclRow>;
  subjectPubkey: string;
  actorPubkey: string;
}>): RoomKeyWrapAclDecision => {
  const subject = normalizePubkey(params.subjectPubkey);
  const actor = normalizePubkey(params.actorPubkey);
  if (!subject || !actor) {
    return { allowed: false, error: "invalid_pubkeys" };
  }

  const { active, bootstrapStewardPubkey } = materializeMembershipSetsFromDeltas(params.existingDeltas);

  if (actor === subject) {
    if (!active.has(subject)) {
      return { allowed: false, error: "subject_not_active" };
    }
    return { allowed: true };
  }

  if (!bootstrapStewardPubkey || actor !== bootstrapStewardPubkey) {
    return { allowed: false, error: "wrap_publish_forbidden" };
  }
  if (!active.has(subject)) {
    return { allowed: false, error: "wrap_subject_not_active" };
  }
  return { allowed: true };
};
