"use client";

import type React from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

  if (!props.isOpen) {
    return null;
  }

  const title = props.title ?? t("profiles.portability.archive.profileDataExported");
  const description = props.description ?? t("profiles.portability.archive.defaultDescription");

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
            {t("profiles.portability.archive.done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
