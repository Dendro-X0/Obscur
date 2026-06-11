/**
 * Native DM sidebar — dm-kernel list authority.
 */

import type { DmConversation } from "../types";
import { resolveDmKernelSidebarConnections } from "@/app/features/dm-kernel/dm-kernel-conversation-list";
import { isNativeDmSqliteReadOwner } from "./native-dm-read-policy";

export const isNativeDmConversationListSqliteOwner = (): boolean => isNativeDmSqliteReadOwner();

export const resolveNativeDmSidebarConnections = resolveDmKernelSidebarConnections;

/** Chat-state `createdConnections` must not paint the sidebar before SQLite loads on native. */
export const shouldNativeDmSkipChatStateSidebarConnectionHydrate = (): boolean => (
  isNativeDmConversationListSqliteOwner()
);
