"use client";
import React, { useState } from "react";
import { PageShell } from "../components/page-shell";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import useNavBadges from "@/app/features/main-shell/hooks/use-nav-badges";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { Card, Button } from "@dweb/ui-kit";
import { useRouter } from "next/navigation";
import { cn } from "@/app/lib/utils";
import { IdentityCard } from "../components/identity-card";
import { useTranslation } from "react-i18next";
import { Lock, Upload, RefreshCw, Settings2 } from "lucide-react";
import { isLesNativeAvailable } from "@/app/features/les/sdk/les-native-sdk";
import { useLesVaultMedia } from "@/app/features/les/ui/use-les-vault-media";
import { LesUploadModal } from "@/app/features/les/ui/les-upload-modal";
import { VaultMediaGrid } from "@/app/features/vault/components/vault-media-grid";
import { useMobileCompactLayout, useTabletSecondaryLayout } from "@/app/features/runtime/use-mobile-compact-layout";

/**
 * R6: Vault page — LES data plane + reused VaultMediaGrid preview UI.
 */
export default function VaultPageClient(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const compact = useMobileCompactLayout();
  const tablet = useTabletSecondaryLayout();
  const identity = useIdentity();
  const publicKeyHex: string | null = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
  const navBadges = useNavBadges({ publicKeyHex: (publicKeyHex as PublicKeyHex | null) ?? null });

  if (!publicKeyHex) {
    return (
      <PageShell title={t("nav.vault")} navBadgeCounts={navBadges.navBadgeCounts}>
        <div className="mx-auto w-full max-w-3xl p-4">
          <Card title={t("vault.noIdentity")} description={t("vault.noIdentityDesc")} className="w-full">
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => router.push("/settings")}>{t("settings.title")}</Button>
            </div>
            <div className="pt-3">
              <IdentityCard />
            </div>
          </Card>
        </div>
      </PageShell>
    );
  }

  if (!isLesNativeAvailable()) {
    return (
      <PageShell title={t("nav.vault")} navBadgeCounts={navBadges.navBadgeCounts}>
        <div className="mx-auto w-full max-w-3xl p-4">
          <Card
            title={t("nav.vault")}
            description="Encrypted Vault (LES) requires the Obscur desktop app. The legacy WebView vault catalog has been retired."
            className="w-full"
          >
            <Button type="button" onClick={() => router.push("/settings")}>{t("settings.title")}</Button>
          </Card>
        </div>
      </PageShell>
    );
  }

  return <LesVaultPageBody compact={compact} tablet={tablet} navBadgeCounts={navBadges.navBadgeCounts} />;
}

function LesVaultPageBody(props: Readonly<{
  compact: boolean;
  tablet: boolean;
  navBadgeCounts: ReturnType<typeof useNavBadges>["navBadgeCounts"];
}>): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    mediaItems,
    isLoading,
    error,
    refresh,
    downloadToLocalPath,
    deleteLocalCopy,
    openLocalFileLocation,
    stats,
  } = useLesVaultMedia();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const { compact, tablet, navBadgeCounts } = props;

  return (
    <PageShell title={t("nav.vault")} navBadgeCounts={navBadgeCounts} containScroll={compact}>
      <div className={cn("mx-auto flex w-full min-h-0 flex-1 flex-col overflow-hidden", compact ? "max-w-3xl p-3" : tablet ? "max-w-4xl p-4" : "max-w-7xl p-6 py-8")}>
        <div className={cn("flex shrink-0 flex-col items-start justify-between", compact ? "mb-4 gap-3" : "mb-8 gap-6 md:flex-row md:items-center")}>
          <div className={cn("flex items-center", compact ? "gap-3" : "gap-6")}>
            <div className={cn("flex shrink-0 items-center justify-center rounded-[28px] bg-gradient-to-br from-primary to-indigo-600 shadow-2xl shadow-primary/20", compact ? "h-12 w-12 rounded-2xl" : "h-20 w-20")}>
              <Lock className={cn("text-white", compact ? "h-5 w-5" : "h-10 w-10")} />
            </div>
            <div className="space-y-0.5">
              <h2 className={cn("font-black tracking-tight text-zinc-900 dark:text-white", compact ? "text-xl" : "text-3xl")}>{t("nav.vault")}</h2>
              {!compact ? (
                <p className="max-w-md text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  LES · encrypted local catalog · preview via VaultMediaGrid
                </p>
              ) : null}
            </div>
          </div>
          <div className={cn("flex items-center gap-2", compact ? "w-full" : "w-full gap-3 md:w-auto")}>
            <Button
              onClick={() => setIsUploadOpen(true)}
              className={cn("rounded-2xl bg-primary font-black text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90", compact ? "h-11 min-h-[44px] flex-1 px-4 text-sm" : "h-12 flex-1 px-6 md:flex-none")}
            >
              <Upload className="mr-2 h-4 w-4" />
              {t("vault.upload")}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => { void refresh(); }}
              className={cn("rounded-2xl border border-zinc-300/90 bg-zinc-100 text-zinc-700 shadow-sm hover:bg-zinc-200 dark:border-border dark:bg-muted dark:text-foreground dark:hover:bg-muted/80", compact ? "h-11 w-11 shrink-0" : "h-12 w-12")}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => router.push("/settings?tab=storage")}
              className={cn("rounded-2xl border border-zinc-300/90 bg-zinc-100 text-zinc-700 shadow-sm hover:bg-zinc-200 dark:border-border dark:bg-muted dark:text-foreground dark:hover:bg-muted/80", compact ? "h-11 w-11 shrink-0" : "h-12 w-12")}
              aria-label={t("settings.tabs.storage")}
              title={t("settings.tabs.storage")}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mb-4 shrink-0 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div data-testid="vault-les-scroll-region" className={cn("min-h-0 flex-1", compact && "mobile-scroll-region overflow-y-auto")}>
          <VaultMediaGrid
            mediaItems={mediaItems}
            isLoading={isLoading}
            stats={stats}
            refresh={() => { void refresh(); }}
            downloadToLocalPath={downloadToLocalPath}
            deleteLocalCopy={deleteLocalCopy}
            openLocalFileLocation={openLocalFileLocation}
          />
        </div>
      </div>

      <LesUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadComplete={() => { void refresh(); }}
      />
    </PageShell>
  );
}
