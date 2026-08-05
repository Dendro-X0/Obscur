import type { RelayCheckpointRecord } from "@dweb/db";
import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  buildTransportListConfiguredRelayUrlsRequest,
  buildTransportListRelayCheckpointsRequest,
  buildTransportUpsertRelayCheckpointRequest,
} from "@obscur/engine-contracts";

export type TransportPersistenceParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
}>;

export const listRelayCheckpoints = async (
  params: TransportPersistenceParams,
): Promise<ReadonlyArray<RelayCheckpointRecord>> => {
  const result = await params.host.invoke(
    buildTransportListRelayCheckpointsRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "transport.listRelayCheckpoints failed");
  }
  return (result.data ?? []) as RelayCheckpointRecord[];
};

/** Profile-scoped relay URLs from workspace groups + persisted checkpoints (protocol-neutral). */
export const listConfiguredRelayUrls = async (
  params: TransportPersistenceParams,
): Promise<ReadonlyArray<string>> => {
  const result = await params.host.invoke(
    buildTransportListConfiguredRelayUrlsRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "transport.listConfiguredRelayUrls failed");
  }
  return (result.data ?? []) as string[];
};

export const upsertRelayCheckpoint = async (
  params: TransportPersistenceParams & Readonly<{
    checkpoint: RelayCheckpointRecord;
  }>,
): Promise<void> => {
  const result = await params.host.invoke(
    buildTransportUpsertRelayCheckpointRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      payload: params.checkpoint,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "transport.upsertRelayCheckpoint failed");
  }
};

export const buildCheckpointRelayUrlSet = (
  checkpoints: ReadonlyArray<RelayCheckpointRecord>,
): ReadonlySet<string> => new Set(
  checkpoints
    .map((entry) => entry.relay_url.trim())
    .filter((url) => url.length > 0),
);
