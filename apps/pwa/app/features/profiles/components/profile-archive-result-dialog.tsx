"use client";

import type React from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dweb/ui-kit";
import type { ProfileWorkspaceArchiveWriteResult } from "@/app/features/profiles/services/profile-workspace-archive-contracts";
import { ProfileArchiveResultBanner } from "./profile-archive-result-banner";

type Props = Readonly<{
  result: ProfileWorkspaceArchiveWriteResult | null;
  isOpen: boolean;
  title?: string;
  description?: string;
  profileLabel?: string;
  showExportsFolder?: boolean;
  onClose: () => void;
}>;

export function ProfileArchiveResultDialog(props: Props): React.JSX.Element | null {
  if (!props.isOpen) {
    return null;
  }

  const title = props.title ?? "Profile data exported";
  const description = props.description
    ?? "A workspace archive was saved before local data was removed. Use the actions below to open or copy paths.";

  return (
    <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ProfileArchiveResultBanner
          result={props.result}
          profileLabel={props.profileLabel}
          showExportsFolder={props.showExportsFolder}
        />
        <DialogFooter>
          <Button type="button" onClick={props.onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
