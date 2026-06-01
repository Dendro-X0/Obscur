"use client";

import type React from "react";
import { Button } from "@dweb/ui-kit";
import type { ProfileWorkspaceArchiveWriteResult } from "@/app/features/profiles/services/profile-workspace-archive-contracts";
import { ProfileArchiveResultBanner } from "./profile-archive-result-banner";

type Props = Readonly<{
  result: ProfileWorkspaceArchiveWriteResult | null;
  title?: string;
  description?: string;
  profileLabel?: string;
  showExportsFolder?: boolean;
  onClose: () => void;
}>;

/** Inline archive result on auth — avoids modal overlay below dialog content z-index. */
export function ProfileArchiveResultInline(props: Props): React.JSX.Element {
  const title = props.title ?? "Profile data exported";
  const description = props.description
    ?? "A workspace archive was saved before local data was removed. Use the actions below to open or copy paths.";

  return (
    <div
      className="mt-4 w-full rounded-[24px] border border-emerald-500/30 bg-emerald-500/5 px-4 py-4 text-left shadow-lg"
      role="region"
      aria-label="Profile archive export result"
    >
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{description}</p>
        </div>
        <ProfileArchiveResultBanner
          result={props.result}
          profileLabel={props.profileLabel}
          showExportsFolder={props.showExportsFolder}
        />
        <Button type="button" onClick={props.onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
