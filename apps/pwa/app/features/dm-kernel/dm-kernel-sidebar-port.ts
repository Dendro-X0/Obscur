import { dbGetConversations } from "@dweb/db";
import { listDmConversations } from "@obscur/dm-engine";
import { createTauriEngineHost } from "@obscur/engine-host/tauri";
import type { HostEnginePort } from "@obscur/engine-contracts";
import type { DmConversation } from "@/app/features/messaging/types";
import { isEngineLabStrictMode } from "@/app/engine-lab/engine-lab-policy";
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

/** Sole native sidebar read — SQLite conversation index only. */
export const loadDmKernelSidebar = async (profileId: string): Promise<ReadonlyArray<DmConversation>> => {
  recordDmKernelInvoke({
    kind: "conversations",
    profileId,
    atUnixMs: Date.now(),
    source: "sqlite",
  });
  const records = isEngineLabStrictMode()
    ? await listDmConversations({ host: getDmKernelEngineHost(), profileId })
    : await dbGetConversations(profileId);
  return resolveDmKernelSidebarConnections(records.map(conversationRecordToDmKernelRow));
};
