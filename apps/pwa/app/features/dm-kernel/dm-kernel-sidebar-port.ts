import { dbGetConversations } from "@dweb/db";
import type { DmConversation } from "@/app/features/messaging/types";
import {
  conversationRecordToDmKernelRow,
  resolveDmKernelSidebarConnections,
} from "./dm-kernel-conversation-list";
import { recordDmKernelInvoke } from "./dm-kernel-invoke-audit";

/** Sole native sidebar read — SQLite conversation index only. */
export const loadDmKernelSidebar = async (profileId: string): Promise<ReadonlyArray<DmConversation>> => {
  recordDmKernelInvoke({
    kind: "conversations",
    profileId,
    atUnixMs: Date.now(),
    source: "sqlite",
  });
  const records = await dbGetConversations(profileId);
  return resolveDmKernelSidebarConnections(records.map(conversationRecordToDmKernelRow));
};
