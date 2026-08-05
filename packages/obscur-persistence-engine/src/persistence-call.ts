import type { CallRecord } from "@dweb/db";
import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  buildPersistenceListCallRecordsRequest,
  buildPersistenceUpsertCallRecordRequest,
} from "@obscur/engine-contracts";

export type PersistenceCallParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
}>;

export const listCallRecords = async (
  params: PersistenceCallParams,
): Promise<ReadonlyArray<CallRecord>> => {
  const result = await params.host.invoke(
    buildPersistenceListCallRecordsRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "persistence.listCallRecords failed");
  }
  return (result.data ?? []) as CallRecord[];
};

export const upsertCallRecord = async (
  params: PersistenceCallParams & Readonly<{
    record: CallRecord;
  }>,
): Promise<void> => {
  const result = await params.host.invoke(
    buildPersistenceUpsertCallRecordRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      payload: params.record,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "persistence.upsertCallRecord failed");
  }
};
