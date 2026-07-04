import type { MeshEnvelope } from "./envelope";

export type MeshEnvelopeValidationResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: string }>;

export const validateMeshEnvelope = (
  envelope: MeshEnvelope,
): MeshEnvelopeValidationResult => {
  if (!envelope.envelopeId.trim()) {
    return { ok: false, reason: "envelope_id_required" };
  }
  if (!envelope.scope.profileId.trim()) {
    return { ok: false, reason: "profile_id_required" };
  }
  if (envelope.ciphertext.byteLength === 0) {
    return { ok: false, reason: "ciphertext_required" };
  }
  if (envelope.createdAtUnixMs <= 0) {
    return { ok: false, reason: "created_at_invalid" };
  }
  if (envelope.messageScope === "dm") {
    if (envelope.audience.kind !== "dm" || !envelope.audience.recipientPublicKeyHex.trim()) {
      return { ok: false, reason: "dm_audience_invalid" };
    }
  }
  if (envelope.messageScope === "workspace") {
    if (envelope.audience.kind !== "workspace" || !envelope.audience.communityId.trim()) {
      return { ok: false, reason: "workspace_audience_invalid" };
    }
  }
  if (envelope.messageScope === "control") {
    if (envelope.audience.kind !== "control" || !envelope.audience.coordinationTopic.trim()) {
      return { ok: false, reason: "control_audience_invalid" };
    }
  }
  return { ok: true };
};
