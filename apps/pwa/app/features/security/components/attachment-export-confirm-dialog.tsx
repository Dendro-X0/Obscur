"use client";

import type React from "react";
import { useTranslation } from "react-i18next";
import { Download, X } from "lucide-react";
import { Button } from "@dweb/ui-kit";

type AttachmentExportConfirmDialogProps = Readonly<{
  fileName: string | null;
  onClose: () => void;
  onConfirm: () => void;
}>;

export function AttachmentExportConfirmDialog({
  fileName,
  onClose,
  onConfirm,
}: AttachmentExportConfirmDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();

  if (!fileName) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[155] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      data-testid="attachment-export-confirm-dialog"
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-border/70 bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              {t("security.exportSafety.eyebrow")}
            </p>
            <h2 className="mt-1 text-lg font-black text-foreground">
              {t("security.exportSafety.title")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("security.exportSafety.description")}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
            <p className="break-all font-mono text-xs text-foreground">{fileName}</p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose}>
              {t("security.exportSafety.cancel")}
            </Button>
            <Button onClick={onConfirm}>
              <Download className="mr-2 h-4 w-4" />
              {t("security.exportSafety.confirm")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
