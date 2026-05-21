"use client";

import React from "react";
import { Clock, WifiOff } from "lucide-react";
import { cn } from "@dweb/ui-kit";
import { useCommunityLeaveOutboxIndex, resolveLeaveOutboxScopeId } from "../hooks/use-community-leave-outbox-index";
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
  if (items.length === 0) {
    return null;
  }

  const pendingCount = items.filter((item) => item.status === "pending" || item.status === "retrying").length;
  const rateLimitedCount = items.filter((item) => item.status === "rate_limited").length;
  const rejectedCount = items.filter((item) => item.status === "rejected").length;

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

  return (
    <div
      role="status"
      data-testid="community-leave-outbox-summary-banner"
      className={cn(
        "rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200",
        className,
      )}
    >
      <span className="font-semibold">Leave confirmations pending on relay</span>
      <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">
        {detailParts.join(" · ")}. Local leave is already recorded; background retry continues while you use the app.
      </span>
    </div>
  );
};
