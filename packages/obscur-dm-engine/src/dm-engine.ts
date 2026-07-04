import type { ConversationRecord, MessageRecord } from "@dweb/db";
import type { HostEnginePort } from "@obscur/engine-contracts";
import {
  buildDmGetThreadRequest,
  buildDmListConversationsRequest,
  type DmGetThreadPayload,
} from "@obscur/engine-contracts";

export type FetchDmThreadParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
  payload: DmGetThreadPayload;
}>;

export const fetchDmThreadRows = async (
  params: FetchDmThreadParams,
): Promise<ReadonlyArray<MessageRecord>> => {
  const result = await params.host.invoke(
    buildDmGetThreadRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
      payload: params.payload,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "dm.getThread failed");
  }
  return (result.data ?? []) as MessageRecord[];
};

export type ListDmConversationsParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
}>;

export const listDmConversations = async (
  params: ListDmConversationsParams,
): Promise<ReadonlyArray<ConversationRecord>> => {
  const result = await params.host.invoke(
    buildDmListConversationsRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "dm.listConversations failed");
  }
  return (result.data ?? []) as ConversationRecord[];
};
