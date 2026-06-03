export type MobileShellStatusTone = "info" | "warning" | "error" | "sync" | "relay";

export type MobileShellStatusItem = Readonly<{
  id: string;
  tone: MobileShellStatusTone;
  title: string;
  body: string;
  priority: number;
  actionId?: "open_profiles";
}>;

export type BuildMobileShellStatusItemsInput = Readonly<{
  showRestoreProgress: boolean;
  restoreMessage?: string | null;
  showMissingSharedDataWarning: boolean;
  showHistorySyncNotice: boolean;
  showProjectionScopeMismatchNotice: boolean;
  scopeMismatchTitle?: string;
  scopeMismatchBody?: string;
  relayBannerCopy?: string | null;
  /** Hide restore/sync/relay notices while account data is still loading. */
  suppressAccountLoadingNotices?: boolean;
}>;

const TONE_PRIORITY: Record<MobileShellStatusTone, number> = {
  error: 0,
  warning: 10,
  relay: 20,
  sync: 30,
  info: 40,
};

export function compareMobileShellStatusItems(
  left: MobileShellStatusItem,
  right: MobileShellStatusItem,
): number {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }
  return TONE_PRIORITY[left.tone] - TONE_PRIORITY[right.tone];
}

export function buildMobileShellStatusItems(
  input: BuildMobileShellStatusItemsInput,
): readonly MobileShellStatusItem[] {
  const items: MobileShellStatusItem[] = [];
  const suppressLoadingNotices = input.suppressAccountLoadingNotices === true;

  if (input.showProjectionScopeMismatchNotice) {
    items.push({
      id: "profile_scope_mismatch",
      tone: "error",
      title: input.scopeMismatchTitle ?? "Profile scope notice",
      body: input.scopeMismatchBody
        ?? "This window is bound to a different local profile slot than this account's data.",
      priority: 0,
      actionId: "open_profiles",
    });
  }

  if (!suppressLoadingNotices && input.showMissingSharedDataWarning) {
    items.push({
      id: "restore_missing_shared_data",
      tone: "warning",
      title: "Account restore warning",
      body: "Shared account data was not found on relays yet. Local identity access remains active.",
      priority: 10,
    });
  }

  if (!suppressLoadingNotices && input.showRestoreProgress) {
    items.push({
      id: "account_restore_progress",
      tone: "sync",
      title: "Account restore",
      body: input.restoreMessage
        ? `${input.restoreMessage} You can keep using the app while relay recovery runs.`
        : "Restoring account data. You can keep using the app while relay recovery runs.",
      priority: 20,
    });
  }

  if (!suppressLoadingNotices && input.showHistorySyncNotice) {
    items.push({
      id: "history_sync",
      tone: "sync",
      title: "Syncing account history",
      body: "This device is still restoring contacts and messages. First-time recovery can take a few minutes.",
      priority: 30,
    });
  }

  const relayCopy = !suppressLoadingNotices ? input.relayBannerCopy?.trim() : null;
  if (relayCopy) {
    items.push({
      id: "relay_transport",
      tone: "relay",
      title: "Relay connection",
      body: relayCopy,
      priority: 40,
    });
  }

  return items.sort(compareMobileShellStatusItems);
}

export function summarizeMobileShellStatusItems(
  items: readonly MobileShellStatusItem[],
): Readonly<{ primary: MobileShellStatusItem | null; extraCount: number }> {
  if (items.length === 0) {
    return { primary: null, extraCount: 0 };
  }
  const sorted = [...items].sort(compareMobileShellStatusItems);
  return {
    primary: sorted[0] ?? null,
    extraCount: Math.max(0, sorted.length - 1),
  };
}
