"use client";

import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Lock, X } from "lucide-react";
import { Button } from "@dweb/ui-kit/button";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { activateNativeStorageAtRestUnlock } from "@/app/features/storage/services/native-storage-at-rest-service";
import { resolveVaultProfileId } from "@/app/features/storage/services/vault-at-rest";

type VaultWriteUnlockDialogProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
  onUnlocked: () => void | Promise<void>;
}>;

/** English defaults — dialog must never show raw i18n keys if the resource bundle is stale. */
const COPY = {
  eyebrow: "Encrypted vault",
  title: "Unlock vault writes",
  description:
    "Enter this profile's password once so Obscur can encrypt vault files for this account. Stay signed in will keep vault unlock available after restart.",
  passphraseLabel: "Profile password",
  passphraseRequired: "Enter your profile password to continue.",
  confirm: "Unlock and save",
  unlockRequired: "Unlock this profile to save encrypted vault files.",
} as const;

export function VaultWriteUnlockDialog({
  isOpen,
  onClose,
  onUnlocked,
}: VaultWriteUnlockDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [passphrase, setPassphrase] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const submit = async (): Promise<void> => {
    const trimmed = passphrase.trim();
    if (!trimmed) {
      setError(t("vault.writeUnlockPassphraseRequired", COPY.passphraseRequired));
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const activated = await activateNativeStorageAtRestUnlock({
        profileId: resolveVaultProfileId(),
        passphrase: trimmed as Passphrase,
      });
      if (!activated) {
        setError(t("vault.localSaveUnlockRequired", COPY.unlockRequired));
        return;
      }
      setPassphrase("");
      await onUnlocked();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("vault.localSaveUnlockRequired", COPY.unlockRequired),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center bg-transparent p-4"
      onClick={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
      data-testid="vault-write-unlock-dialog"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-border/70 bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              {t("vault.writeUnlockEyebrow", COPY.eyebrow)}
            </p>
            <h2 className="mt-1 text-lg font-black text-foreground">
              {t("vault.writeUnlockTitle", COPY.title)}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("vault.writeUnlockDescription", COPY.description)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label={t("common.close", "Close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form
          className="space-y-4 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              {t("vault.writeUnlockPassphraseLabel", COPY.passphraseLabel)}
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              disabled={isSubmitting}
              className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm text-foreground outline-none ring-primary/40 focus:ring-2"
              data-testid="vault-write-unlock-passphrase"
            />
          </label>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Lock className="mr-2 h-4 w-4" />
              )}
              {t("vault.writeUnlockConfirm", COPY.confirm)}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
