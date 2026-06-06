"use client";

import React from "react";
import { Clock } from "lucide-react";
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
  if (!item || item.status === "published" || item.status === "rejected") {
    return null;
  }

  const copy = resolveCommunityLeavePublishSurfaceCopy(item);
  const Icon = Clock;

  return (
    <div
      role="status"
      data-testid="community-leave-publish-pending-notice"
      data-leave-publish-status={item.status}
      className={cn(
        "rounded-2xl border px-4 py-3",
        "border-amber-500/30 bg-amber-500/10",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
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
