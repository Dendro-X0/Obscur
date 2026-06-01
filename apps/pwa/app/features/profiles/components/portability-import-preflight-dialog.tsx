"use client";

import type React from "react";
import { Dialog, DialogContent } from "@dweb/ui-kit";
import type { PortabilityImportPreflight } from "@/app/features/profiles/services/portability-import-preflight";
import { PortabilityImportPreflightContent } from "./portability-import-preflight-content";

type Props = Readonly<{
  preflight: PortabilityImportPreflight | null;
  isOpen: boolean;
  isApplying?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}>;

export function PortabilityImportPreflightDialog(props: Props): React.JSX.Element | null {
  if (!props.isOpen) {
    return null;
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent className="max-w-lg">
        <PortabilityImportPreflightContent
          preflight={props.preflight}
          isApplying={props.isApplying}
          onClose={props.onClose}
          onConfirm={props.onConfirm}
        />
      </DialogContent>
    </Dialog>
  );
}
