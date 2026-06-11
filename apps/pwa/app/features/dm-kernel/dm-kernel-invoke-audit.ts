/**
 * P3 — session-scoped SQLite invoke counters for dm-kernel read ports.
 */

export type DmKernelInvokeKind = "messages_initial" | "messages_pagination" | "conversations";

export type DmKernelInvokeRecord = Readonly<{
  kind: DmKernelInvokeKind;
  profileId: string;
  conversationId?: string;
  atUnixMs: number;
  source: "sqlite" | "session_cache";
}>;

const invokeLog: DmKernelInvokeRecord[] = [];

const messageInitialCountByKey = new Map<string, number>();
const messagePaginationCountByKey = new Map<string, number>();
const conversationCountByProfile = new Map<string, number>();

const threadKey = (profileId: string, conversationId: string): string => (
  `${profileId.trim()}:${conversationId.trim()}`
);

export const resetDmKernelInvokeAuditForTests = (): void => {
  invokeLog.length = 0;
  messageInitialCountByKey.clear();
  messagePaginationCountByKey.clear();
  conversationCountByProfile.clear();
};

export const recordDmKernelInvoke = (record: DmKernelInvokeRecord): void => {
  invokeLog.push(record);
  if (record.kind === "messages_initial") {
    const key = threadKey(record.profileId, record.conversationId ?? "");
    messageInitialCountByKey.set(key, (messageInitialCountByKey.get(key) ?? 0) + 1);
    return;
  }
  if (record.kind === "messages_pagination") {
    const key = threadKey(record.profileId, record.conversationId ?? "");
    messagePaginationCountByKey.set(key, (messagePaginationCountByKey.get(key) ?? 0) + 1);
    return;
  }
  if (record.kind === "conversations") {
    const profileId = record.profileId.trim();
    conversationCountByProfile.set(profileId, (conversationCountByProfile.get(profileId) ?? 0) + 1);
  }
};

export const getDmKernelInvokeLog = (): ReadonlyArray<DmKernelInvokeRecord> => invokeLog;

export const getDmKernelMessageInitialInvokeCount = (
  profileId: string,
  conversationId: string,
): number => messageInitialCountByKey.get(threadKey(profileId, conversationId)) ?? 0;

export const getDmKernelMessagePaginationInvokeCount = (
  profileId: string,
  conversationId: string,
): number => messagePaginationCountByKey.get(threadKey(profileId, conversationId)) ?? 0;

export const getDmKernelConversationInvokeCount = (profileId: string): number => (
  conversationCountByProfile.get(profileId.trim()) ?? 0
);

export type DmKernelThreadOpenBudgetResult = Readonly<{
  pass: boolean;
  initialSqliteInvokes: number;
  paginationInvokes: number;
  issues: ReadonlyArray<string>;
}>;

/** P3 exit: ≤1 initial SQLite read per conversation per session (pagination extra). */
export const evaluateDmKernelThreadOpenBudget = (
  profileId: string,
  conversationId: string,
  options?: Readonly<{ maxInitialSqliteInvokes?: number }>,
): DmKernelThreadOpenBudgetResult => {
  const maxInitial = options?.maxInitialSqliteInvokes ?? 1;
  const initialRecords = invokeLog.filter((record) => (
    record.kind === "messages_initial"
    && record.source === "sqlite"
    && record.profileId === profileId
    && record.conversationId === conversationId
  ));
  const paginationInvokes = getDmKernelMessagePaginationInvokeCount(profileId, conversationId);
  const issues: string[] = [];
  if (initialRecords.length > maxInitial) {
    issues.push(`initial_sqlite_${initialRecords.length}`);
  }
  return {
    pass: issues.length === 0,
    initialSqliteInvokes: initialRecords.length,
    paginationInvokes,
    issues,
  };
};
