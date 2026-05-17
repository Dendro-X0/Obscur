export type RequestConvergenceState =
  | "none"
  | "pending_local"
  | "pending_evidenced"
  | "accepted"
  | "rejected"
  | "terminal_failed";

export type RequestFlowEvidence = Readonly<{
  requestEventId?: string;
  receiptAckSeen: boolean;
  acceptSeen: boolean;
  lastEvidenceUnixMs?: number;
}>;

export type RequestTransportStatus =
  | "ok"
  | "partial"
  | "queued"
  | "failed"
  | "unsupported";

export type TwoUserDeterministicRunStep = Readonly<{
  name: string;
  passed: boolean;
  detail?: string;
}>;

export type TwoUserDeterministicRunReport = Readonly<{
  iteration: number;
  steps: ReadonlyArray<TwoUserDeterministicRunStep>;
  firstDivergenceStep?: string;
}>;

export const createEmptyRequestFlowEvidence = (): RequestFlowEvidence => ({
  receiptAckSeen: false,
  acceptSeen: false,
});
