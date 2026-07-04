import type { MeshEvidenceRecord } from "@obscur/conduit-mesh-contracts";

export type EvidenceLedger = Readonly<{
  append: (record: MeshEvidenceRecord) => void;
  appendMany: (records: ReadonlyArray<MeshEvidenceRecord>) => void;
  listForEnvelope: (envelopeId: string) => ReadonlyArray<MeshEvidenceRecord>;
  subscribe: (handler: (record: MeshEvidenceRecord) => void) => () => void;
}>;

export const createEvidenceLedger = (): EvidenceLedger => {
  const records: MeshEvidenceRecord[] = [];
  const listeners = new Set<(record: MeshEvidenceRecord) => void>();

  const emit = (record: MeshEvidenceRecord): void => {
    for (const listener of listeners) {
      listener(record);
    }
  };

  return {
    append: (record) => {
      records.push(record);
      emit(record);
    },
    appendMany: (batch) => {
      for (const record of batch) {
        records.push(record);
        emit(record);
      }
    },
    listForEnvelope: (envelopeId) => records.filter((r) => r.envelopeId === envelopeId),
    subscribe: (handler) => {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
  };
};
