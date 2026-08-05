import type { MessageSearchResult } from "@dweb/db";
import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  buildPersistenceSearchMessagesRequest,
  buildPersistenceWipeProfileLocalDataRequest,
  type PersistenceWipeProfileLocalDataReport,
} from "@obscur/engine-contracts";

export type PersistenceUtilityParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
}>;

export const searchMessages = async (
  params: PersistenceUtilityParams & Readonly<{
    query: string;
    limit?: number;
  }>,
): Promise<ReadonlyArray<MessageSearchResult>> => {
  const result = await params.host.invoke(
    buildPersistenceSearchMessagesRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      payload: {
        query: params.query,
        ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
      },
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "persistence.searchMessages failed");
  }
  return (result.data ?? []) as MessageSearchResult[];
};

export const wipeProfileLocalData = async (
  params: PersistenceUtilityParams & Readonly<{
    removeProfileRow?: boolean;
  }>,
): Promise<PersistenceWipeProfileLocalDataReport> => {
  const result = await params.host.invoke(
    buildPersistenceWipeProfileLocalDataRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      payload: { removeProfileRow: params.removeProfileRow === true },
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "persistence.wipeProfileLocalData failed");
  }
  return (result.data ?? {
    profile_id: params.profileId,
    rows_deleted: 0,
    profile_row_deleted: false,
  }) as PersistenceWipeProfileLocalDataReport;
};
