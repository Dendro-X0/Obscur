"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@dweb/ui-kit";
import { X } from "lucide-react";
import {
  clearPendingProfileImport,
  loadPendingProfileImport,
  pendingImportAccountPrefix,
} from "@/app/features/profiles/services/pending-profile-import-service";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

export function AuthLoginPendingImportNotice(): React.JSX.Element | null {
  const profileId = getResolvedProfileId();
  const [pending, setPending] = useState(() => loadPendingProfileImport(profileId));

  useEffect(() => {
    setPending(loadPendingProfileImport(profileId));
  }, [profileId]);

  if (!pending) {
    return null;
  }

  return (
    <div className="rounded-[20px] border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-left">
      <div className="text-xs font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
        Backup ready to import
      </div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        <span className="font-semibold">{pending.fileName}</span>
        {" · "}
        account {pendingImportAccountPrefix(pending.bundlePublicKeyHex)}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        Sign in with the matching private key or username/password. Import confirms automatically after unlock.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2 h-8 text-xs font-bold"
        onClick={() => {
          clearPendingProfileImport(profileId);
          setPending(null);
        }}
      >
        <X className="h-3.5 w-3.5" />
        Clear staged backup
      </Button>
    </div>
  );
}
