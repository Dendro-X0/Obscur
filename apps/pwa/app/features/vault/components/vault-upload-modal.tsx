"use client";

import React from "react";
import { LesUploadModal } from "@/app/features/les/ui/les-upload-modal";

type VaultUploadModalProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (url: string) => void;
}>;

/**
 * R5 tombstone: legacy Vault upload wrote via the retired local vault store.
 * Prefer importing `LesUploadModal` directly.
 */
export function VaultUploadModal({
  isOpen,
  onClose,
  onUploadComplete,
}: VaultUploadModalProps): React.JSX.Element | null {
  return (
    <LesUploadModal
      isOpen={isOpen}
      onClose={onClose}
      onUploadComplete={() => {
        onUploadComplete?.("les://committed");
      }}
    />
  );
}
