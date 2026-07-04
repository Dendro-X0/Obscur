import type { MeshEnvelope } from "./envelope";

export type MeshEvidenceKind =
  | "published_to_conduit"
  | "accepted_by_operator"
  | "stored_proof"
  | "inbound_at_recipient"
  | "coordination_head_seq"
  | "publish_failed"
  | "evidence_class_satisfied"
  | "evidence_class_expired";

export type MeshEvidenceRecord = Readonly<{
  evidenceId: string;
  envelopeId: string;
  kind: MeshEvidenceKind;
  atUnixMs: number;
  conduitId?: string;
  dialect?: string;
  /** Operator/store reference when applicable (e.g. Nostr event id, HTTP etag). */
  externalRef?: string;
  coordinationHeadSeq?: number;
  failureReason?: string;
  detail?: string;
}>;

export type MeshPublishOutcome = Readonly<{
  envelopeId: string;
  accepted: boolean;
  evidence: ReadonlyArray<MeshEvidenceRecord>;
  errorMessage?: string;
}>;

export type MeshEvidenceHandler = (record: MeshEvidenceRecord) => void;

export type MeshInboundEnvelopeHandler = (params: Readonly<{
  envelope: MeshEnvelope;
  receivedAtUnixMs: number;
  conduitId: string;
  dialect: string;
}>) => void;

export type MeshUnsubscribe = () => void;

export const satisfiesEvidenceClass = (
  evidenceClass: MeshEnvelope["evidenceClass"],
  records: ReadonlyArray<MeshEvidenceRecord>,
): boolean => {
  switch (evidenceClass) {
    case "fire_and_forget":
      return records.some((r) => r.kind === "published_to_conduit");
    case "at_least_one_conduit_accept":
      return records.some((r) => (
        r.kind === "accepted_by_operator" || r.kind === "stored_proof"
      ));
    case "recipient_ack":
      return records.some((r) => r.kind === "inbound_at_recipient");
    case "coordination_head":
      return records.some((r) => r.kind === "coordination_head_seq");
    default:
      return false;
  }
};
