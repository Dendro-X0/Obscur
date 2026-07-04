import type { GroupRecord } from "@dweb/db";
import type { HostEnginePort } from "@obscur/engine-contracts";
import { buildWorkspaceListGroupsRequest } from "@obscur/engine-contracts";

export type ListWorkspaceGroupsParams = Readonly<{
  host: HostEnginePort;
  profileId: string;
  windowLabel?: string;
}>;

export const listWorkspaceGroups = async (
  params: ListWorkspaceGroupsParams,
): Promise<ReadonlyArray<GroupRecord>> => {
  const result = await params.host.invoke(
    buildWorkspaceListGroupsRequest({
      profileId: params.profileId,
      windowLabel: params.windowLabel,
    }),
  );
  if (!result.ok) {
    throw new Error(result.errorMessage ?? result.errorCode ?? "workspace.listGroups failed");
  }
  return (result.data ?? []) as GroupRecord[];
};
