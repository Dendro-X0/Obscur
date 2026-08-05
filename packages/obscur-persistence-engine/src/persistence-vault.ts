import type { VaultMediaIndexRecord } from "@dweb/db";
import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  buildPersistenceDeleteAllVaultMediaIndexRequest,
  buildPersistenceDeleteVaultMediaIndexRequest,
  buildPersistenceListVaultMediaIndexRequest,
  buildPersistenceUpsertVaultMediaIndexRequest,
} from "@obscur/engine-contracts";

export type PersistenceVaultParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
}>;

export const listVaultMediaIndex = async (
  params: PersistenceVaultParams,
): Promise<ReadonlyArray<VaultMediaIndexRecord>> => {
  const result = await params.host.invoke(
    buildPersistenceListVaultMediaIndexRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "persistence.listVaultMediaIndex failed");
  }
  return (result.data ?? []) as VaultMediaIndexRecord[];
};

export const upsertVaultMediaIndex = async (
  params: PersistenceVaultParams & Readonly<{
    record: VaultMediaIndexRecord;
  }>,
): Promise<void> => {
  const result = await params.host.invoke(
    buildPersistenceUpsertVaultMediaIndexRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      payload: params.record,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "persistence.upsertVaultMediaIndex failed");
  }
};

export const deleteVaultMediaIndex = async (
  params: PersistenceVaultParams & Readonly<{
    remoteUrl: string;
  }>,
): Promise<void> => {
  const result = await params.host.invoke(
    buildPersistenceDeleteVaultMediaIndexRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      payload: { remote_url: params.remoteUrl },
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "persistence.deleteVaultMediaIndex failed");
  }
};

export const deleteAllVaultMediaIndex = async (
  params: PersistenceVaultParams,
): Promise<number> => {
  const result = await params.host.invoke(
    buildPersistenceDeleteAllVaultMediaIndexRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "persistence.deleteAllVaultMediaIndex failed");
  }
  const data = result.data as { deleted?: number } | null | undefined;
  return typeof data?.deleted === "number" ? data.deleted : 0;
};
