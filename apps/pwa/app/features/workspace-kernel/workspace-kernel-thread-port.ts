import type { Message } from "@/app/features/messaging/types";
import {
  loadGroupThreadEarlierFromSqlite,
  loadGroupThreadPageFromSqlite,
} from "@/app/features/messaging/services/thread-history/group-thread-sqlite-store";
import type { ThreadHistoryPage } from "@/app/features/messaging/services/thread-history/contracts";
import { THREAD_HISTORY_DEFAULT_PAGE_SIZE } from "@/app/features/messaging/services/thread-history/contracts";
import { isWorkspaceKernelAuthority } from "./workspace-kernel-policy";
import { logWorkspaceKernelDiagnostic } from "./workspace-kernel-diagnostics";

export type WorkspaceKernelThreadPortStatus = "w2_landed";

export const workspaceKernelThreadPortStatus = (): WorkspaceKernelThreadPortStatus => "w2_landed";

export type LoadWorkspaceKernelGroupThreadParams = Readonly<{
  conversationId: string;
  groupId?: string;
  communityId?: string;
  myPublicKeyHex: string | null;
  pageSize?: number;
  beforeReceivedAtMs?: number;
  profileId?: string;
}>;

export type LoadWorkspaceKernelGroupThreadEarlierParams = LoadWorkspaceKernelGroupThreadParams & Readonly<{
  existingMessages: ReadonlyArray<Message>;
}>;

export const isWorkspaceKernelThreadPortReady = (): boolean => isWorkspaceKernelAuthority();

/** Sole managed-workspace group thread read on native — SQLite page load. */
export const loadWorkspaceKernelGroupThreadPage = async (
  params: LoadWorkspaceKernelGroupThreadParams,
): Promise<ThreadHistoryPage<Message>> => {
  logWorkspaceKernelDiagnostic("workspace.thread.hydrate", {
    conversationId: params.conversationId,
    groupId: params.groupId ?? null,
  });
  return loadGroupThreadPageFromSqlite({
    conversationId: params.conversationId,
    groupId: params.groupId,
    communityId: params.communityId,
    myPublicKeyHex: params.myPublicKeyHex,
    profileId: params.profileId,
    pageSize: params.pageSize ?? THREAD_HISTORY_DEFAULT_PAGE_SIZE,
    beforeReceivedAtMs: params.beforeReceivedAtMs,
  });
};

export const loadWorkspaceKernelGroupThreadEarlier = async (
  params: LoadWorkspaceKernelGroupThreadEarlierParams,
): Promise<ThreadHistoryPage<Message>> => (
  loadGroupThreadEarlierFromSqlite({
    conversationId: params.conversationId,
    groupId: params.groupId,
    communityId: params.communityId,
    myPublicKeyHex: params.myPublicKeyHex,
    profileId: params.profileId,
    existingMessages: params.existingMessages,
    beforeReceivedAtMs: params.beforeReceivedAtMs ?? 0,
    pageSize: params.pageSize ?? THREAD_HISTORY_DEFAULT_PAGE_SIZE,
  })
);
