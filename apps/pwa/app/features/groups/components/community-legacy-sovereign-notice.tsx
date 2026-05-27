"use client";

import React from "react";
import { Shield } from "lucide-react";
import { cn } from "@dweb/ui-kit";
import { assessLegacySovereignRoomCommunity } from "../services/community-legacy-sovereign-policy";
import type { CommunityMode } from "../types";

export function CommunityLegacySovereignNotice(props: Readonly<{
  communityMode?: CommunityMode | null;
  relayUrl?: string | null;
  className?: string;
}>): React.JSX.Element | null {
  const assessment = assessLegacySovereignRoomCommunity({
    communityMode: props.communityMode,
    relayUrl: props.relayUrl,
  });
  if (!assessment.isLegacyReadOnly) {
    return null;
  }
  return (
    <div
      className={cn(
        "rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100",
        props.className,
      )}
      role="status"
      data-testid="legacy-sovereign-room-notice"
    >
      <div className="flex items-start gap-2">
        <Shield className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">{assessment.title}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-90">{assessment.detail}</p>
        </div>
      </div>
    </div>
  );
}
