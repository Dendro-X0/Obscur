"use client";

import React, { useCallback } from "react";
import { Clock, LoaderIcon, WifiOff } from "lucide-react";
import { cn } from "@dweb/ui-kit";
import { Button } from "@/app/components/ui/button";
import { useCommunityLeaveOutboxIndex, resolveLeaveOutboxScopeId } from "../hooks/use-community-leave-outbox-index";
import { useRestoreRejectedCommunityLeaves } from "../hooks/use-restore-rejected-community-leaves";
import { resolveCommunityLeavePublishSurfaceCopy } from "../services/community-leave-publish-copy";

export const CommunityLeavePublishPendingNotice = ({
  groupId,
  relayUrl,
  className,
}: Readonly<{
  groupId: string;
  relayUrl: string;
  className?: string;
}>): React.JSX.Element | null => {
  const { byScopeId } = useCommunityLeaveOutboxIndex();
  const item = byScopeId.get(resolveLeaveOutboxScopeId(groupId, relayUrl));
  if (!item || item.status === "published") {
    return null;
  }

  const copy = resolveCommunityLeavePublishSurfaceCopy(item);
  const Icon = item.status === "rejected" ? WifiOff : Clock;

  return (
    <div
      role="status"
      data-testid="community-leave-publish-pending-notice"
      data-leave-publish-status={item.status}
      className={cn(
        "rounded-2xl border px-4 py-3",
        item.status === "rejected"
          ? "border-rose-500/30 bg-rose-500/10"
          : "border-amber-500/30 bg-amber-500/10",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            item.status === "rejected" ? "text-rose-500" : "text-amber-500",
          )}
          aria-hidden
        />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">{copy.title}</p>
          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{copy.detail}</p>
        </div>
      </div>
    </div>
  );
};

export const CommunityLeaveOutboxSummaryBanner = ({
  className,
}: Readonly<{
  className?: string;
}>): React.JSX.Element | null => {
  const { items } = useCommunityLeaveOutboxIndex();
  const { rejectedCount, canRestore, isRestoring, restoreRejected } = useRestoreRejectedCommunityLeaves();

  const handleRestore = useCallback((): void => {
    void restoreRejected();
  }, [restoreRejected]);

  if (items.length === 0) {
    return null;
  }

  const pendingCount = items.filter((item) => item.status === "pending" || item.status === "retrying").length;
  const rateLimitedCount = items.filter((item) => item.status === "rate_limited").length;

  const detailParts: string[] = [];
  if (pendingCount > 0) {
    detailParts.push(`${pendingCount} confirming`);
  }
  if (rateLimitedCount > 0) {
    detailParts.push(`${rateLimitedCount} rate limited`);
  }
  if (rejectedCount > 0) {
    detailParts.push(`${rejectedCount} relay declined`);
  }

  const hasRejectedOnly = rejectedCount > 0 && pendingCount === 0 && rateLimitedCount === 0;

  return (
    <div
      role="status"
      data-testid="community-leave-outbox-summary-banner"
      className={cn(
        "rounded-xl border px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200",
        hasRejectedOnly
          ? "border-rose-500/25 bg-rose-500/10"
          : "border-amber-500/25 bg-amber-500/10",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="font-semibold">Leave confirmations pending on relay</span>
          <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">
            {detailParts.join(" · ")}. Local leave is already recorded
            {pendingCount > 0 || rateLimitedCount > 0
              ? "; background retry continues while you use the app."
              : "."}
            {rejectedCount > 0 && (
              <> Restore communities when relay declined but your device still has the group saved locally.</>
            )}
          </span>
        </div>
        {rejectedCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 border-rose-500/40 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
            disabled={!canRestore}
            data-testid="community-leave-restore-rejected-button"
            onClick={handleRestore}
          >
            {isRestoring ? (
              <>
                <LoaderIcon className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
                Restoring…
              </>
            ) : (
              "Restore communities"
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
