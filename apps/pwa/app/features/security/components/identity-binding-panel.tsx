"use client";

import type React from "react";
import { useTranslation } from "react-i18next";
import { Copy, Fingerprint } from "lucide-react";
import { Button } from "@dweb/ui-kit";
import { cn } from "@/app/lib/utils";
import { Identicon } from "@/app/features/security/components/identicon";
import { SecurityLiteracyNote } from "@/app/features/security/components/security-literacy-note";
import {
  identityBindingSourceI18nKey,
  type IdentityBindingViewModel,
} from "@/app/features/security/services/identity-binding-presenter";

type IdentityBindingPanelProps = Readonly<{
  binding: IdentityBindingViewModel;
  className?: string;
  compact?: boolean;
  showLiteracyNote?: boolean;
  onCopyNpub?: () => void;
  onCopyHex?: () => void;
}>;

export function IdentityBindingPanel({
  binding,
  className,
  compact = false,
  showLiteracyNote = true,
  onCopyNpub,
  onCopyHex,
}: IdentityBindingPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const sourceLabel = t(identityBindingSourceI18nKey(binding.resolverSource));

  return (
    <div
      className={cn(
        "rounded-2xl border border-amber-500/25 bg-amber-500/5",
        compact ? "p-3" : "p-4",
        className,
      )}
      data-testid="identity-binding-panel"
    >
      <div className="flex items-start gap-3">
        <Identicon publicKeyHex={binding.publicKeyHex} size={compact ? 56 : 72} showKeyFragment={false} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
            <p className={cn("font-black uppercase tracking-[0.16em] text-amber-800 dark:text-amber-200", compact ? "text-[10px]" : "text-[11px]")}>
              {t("security.identityBinding.title")}
            </p>
          </div>
          {binding.displayName ? (
            <div>
              <p className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
                {binding.displayName}
              </p>
              {binding.displayNameUntrusted ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t("security.identityBinding.displayNameUntrusted")}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm font-semibold text-foreground">{t("security.identityBinding.unknownContact")}</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                {t("security.identityBinding.npubFragment")}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">{binding.npubFragment}</p>
              {onCopyNpub ? (
                <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-2 text-[11px]" onClick={onCopyNpub}>
                  <Copy className="mr-1 h-3 w-3" />
                  {t("security.identityBinding.copyNpub")}
                </Button>
              ) : null}
            </div>
            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                {t("security.identityBinding.resolverSource")}
              </p>
              <p className="mt-1 text-xs font-semibold text-foreground">{sourceLabel}</p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">{binding.hexFragment}</p>
              {onCopyHex ? (
                <Button type="button" variant="ghost" size="sm" className="mt-1 h-7 px-2 text-[11px]" onClick={onCopyHex}>
                  <Copy className="mr-1 h-3 w-3" />
                  {t("security.identityBinding.copyHex")}
                </Button>
              ) : null}
            </div>
          </div>
          {binding.friendCode ? (
            <div className="rounded-xl border border-border/60 bg-background/60 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                {t("security.identityBinding.friendCode")}
              </p>
              <p className="mt-1 font-mono text-xs text-foreground">{binding.friendCode}</p>
            </div>
          ) : null}
        </div>
      </div>
      {showLiteracyNote ? (
        <SecurityLiteracyNote compact className="mt-3 border-amber-500/15 bg-amber-500/[0.03]" />
      ) : null}
    </div>
  );
}
