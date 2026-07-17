"use client";

import React, { useRef, useState } from "react";
import { Button, toast } from "@dweb/ui-kit";
import { Upload, CheckCircle2, AlertCircle, LoaderIcon, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { uploadFilesToLes } from "../sdk/les-secure-upload";

type LesUploadModalProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
}>;

/**
 * Secure Upload modal backed only by LES (Rust). No local-media-store.
 */
export function LesUploadModal({ isOpen, onClose, onUploadComplete }: LesUploadModalProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) {
    return null;
  }

  const handleFiles = async (files: File[]): Promise<void> => {
    if (files.length === 0) {
      return;
    }
    setIsUploading(true);
    setError(null);
    setSuccessCount(0);
    try {
      const { receipts, failedNames } = await uploadFilesToLes(files);
      if (receipts.length === 0) {
        throw new Error(t("vault.localSaveFailed"));
      }
      setSuccessCount(receipts.length);
      if (failedNames.length > 0) {
        toast.warning(t("vault.partialLocalSave", {
          saved: receipts.length,
          total: files.length,
        }));
      } else {
        toast.success(t("vault.localSuccessDesc"));
      }
      onUploadComplete?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("vault.localSaveFailed");
      if (/Unlock this profile/i.test(message)) {
        setError(t("vault.localSaveUnlockRequired"));
      } else {
        setError(message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-border dark:bg-card"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-zinc-900 dark:text-white">{t("vault.uploadTitle")}</h2>
              <p className="text-xs font-medium text-zinc-500">LES · encrypted local store</p>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              void handleFiles(files);
              event.target.value = "";
            }}
          />

          <Button
            type="button"
            disabled={isUploading}
            className="h-12 w-full rounded-2xl"
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? <LoaderIcon className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {isUploading ? "Uploading…" : t("vault.upload")}
          </Button>

          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {successCount > 0 && !error ? (
            <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t("vault.localSuccessDesc")} ({successCount})</span>
            </div>
          ) : null}

          <div className="mt-6 flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
