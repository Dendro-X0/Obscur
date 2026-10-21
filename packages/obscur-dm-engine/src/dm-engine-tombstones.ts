import type { TombstoneRecord } from "@dweb/db";
import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  buildDmDeleteAllTombstonesRequest,
  buildDmDeleteMessageRequest,
  buildDmDeleteMessagesRequest,
  buildDmInsertTombstoneRequest,
  buildDmInsertTombstonesRequest,
  buildDmListTombstonesRequest,
} from "@obscur/engine-contracts";

export type DmTombstoneParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
}>;

export const listDmTombstones = async (
  params: DmTombstoneParams,
): Promise<ReadonlyArray<TombstoneRecord>> => {
  const result = await params.host.invoke(
    buildDmListTombstonesRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "dm.listTombstones failed");
  }
  return (result.data ?? []) as TombstoneRecord[];
};

export const insertDmTombstone = async (
  params: DmTombstoneParams & Readonly<{
    record: TombstoneRecord;
  }>,
): Promise<void> => {
  const result = await params.host.invoke(
    buildDmInsertTombstoneRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      payload: params.record,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "dm.insertTombstone failed");
  }
};

/** One IPC for many tombstones — prefer over N× `insertDmTombstone` on unlock hydrate. */
export const insertDmTombstones = async (
  params: DmTombstoneParams & Readonly<{
    records: ReadonlyArray<TombstoneRecord>;
  }>,
): Promise<void> => {
  if (params.records.length === 0) {
    return;
  }
  if (params.records.length === 1) {
    await insertDmTombstone({
      host: params.host,
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      record: params.records[0]!,
    });
    return;
  }
  const result = await params.host.invoke(
    buildDmInsertTombstonesRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      payload: { records: params.records },
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "dm.insertTombstones failed");
  }
};

export const deleteAllDmTombstones = async (
  params: DmTombstoneParams,
): Promise<void> => {
  const result = await params.host.invoke(
    buildDmDeleteAllTombstonesRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "dm.deleteAllTombstones failed");
  }
};

export const deleteDmMessages = async (
  params: DmTombstoneParams & Readonly<{
    eventIds: ReadonlyArray<string>;
  }>,
): Promise<void> => {
  const result = await params.host.invoke(
    buildDmDeleteMessagesRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      payload: { eventIds: params.eventIds },
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "dm.deleteMessages failed");
  }
};

export const deleteDmMessage = async (
  params: DmTombstoneParams & Readonly<{
    eventId: string;
  }>,
): Promise<void> => {
  const result = await params.host.invoke(
    buildDmDeleteMessageRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      payload: { eventId: params.eventId },
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "dm.deleteMessage failed");
  }
};
