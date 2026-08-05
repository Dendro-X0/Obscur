import { listDmConversations } from "@obscur/dm-engine";
import { createTauriEngineHost } from "@obscur/engine-host/tauri";
import type { HostEnginePort } from "@obscur/engine-contracts";
import type { DmConversation } from "@/app/features/messaging/types";
import {
  conversationRecordToDmKernelRow,
  resolveDmKernelSidebarConnections,
} from "./dm-kernel-conversation-list";
import { recordDmKernelInvoke } from "./dm-kernel-invoke-audit";

let dmKernelEngineHost: HostEnginePort | null = null;

const getDmKernelEngineHost = (): HostEnginePort => {
  dmKernelEngineHost ??= createTauriEngineHost();
  return dmKernelEngineHost;
};

/** Sole native sidebar read — engine_invoke listConversations only. */
export const loadDmKernelSidebar = async (profileId: string): Promise<ReadonlyArray<DmConversation>> => {
  recordDmKernelInvoke({
    kind: "conversations",
    profileId,
    atUnixMs: Date.now(),
    source: "sqlite",
  });
  const records = await listDmConversations({ host: getDmKernelEngineHost(), profileId });
  return resolveDmKernelSidebarConnections(records.map(conversationRecordToDmKernelRow));
};
