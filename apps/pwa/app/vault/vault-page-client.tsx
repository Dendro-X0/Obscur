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
import { Lock, Upload, RefreshCw, Image as ImageIcon, Settings2 } from "lucide-react";
import { VaultMediaGrid } from "../features/vault/components/vault-media-grid";
import { VaultLegacyMigrationBanner } from "../features/vault/components/vault-legacy-migration-banner";
import { VaultUploadModal } from "../features/vault/components/vault-upload-modal";
import { useVaultMedia } from "../features/vault/hooks/use-vault-media";
import { useMobileCompactLayout, useTabletSecondaryLayout } from "@/app/features/runtime/use-mobile-compact-layout";
export default function VaultPageClient(): React.JSX.Element {
    const { t } = useTranslation();
    const router = useRouter();
    const compact = useMobileCompactLayout();
    const tablet = useTabletSecondaryLayout();
    const identity = useIdentity();
    const { mediaItems, isLoading, stats, refresh, downloadToLocalPath, deleteLocalCopy, openLocalFileLocation } = useVaultMedia();
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const publicKeyHex: string | null = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
    const navBadges = useNavBadges({ publicKeyHex: (publicKeyHex as PublicKeyHex | null) ?? null });
    if (!publicKeyHex) {
        return (<PageShell title={t("nav.vault")} navBadgeCounts={navBadges.navBadgeCounts}>
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
            </PageShell>);
    }
    return (<PageShell title={t("nav.vault")} navBadgeCounts={navBadges.navBadgeCounts} containScroll={compact}>
            <div className={cn("mx-auto flex w-full min-h-0 flex-1 flex-col overflow-hidden", compact ? "max-w-3xl p-3" : tablet ? "max-w-4xl p-4" : "max-w-7xl p-6 py-8")}>
                <div className={cn("flex shrink-0 flex-col items-start justify-between", compact ? "mb-4 gap-3" : "mb-12 gap-6 md:flex-row md:items-center")}>
                    <div className={cn("flex items-center", compact ? "gap-3" : "gap-6")}>
                        <div className={cn("flex shrink-0 items-center justify-center rounded-[28px] bg-gradient-to-br from-primary to-indigo-600 shadow-2xl shadow-primary/20", compact ? "h-12 w-12 rounded-2xl" : "h-20 w-20")}>
                            <Lock className={cn("text-white", compact ? "h-5 w-5" : "h-10 w-10")}/>
                        </div>
                        <div className="space-y-0.5">
                            <h2 className={cn("font-black tracking-tight text-zinc-900 dark:text-white", compact ? "text-xl" : "text-3xl")}>{t("nav.vault")}</h2>
                            {!compact ? (<p className="max-w-md text-sm font-medium text-zinc-500 dark:text-zinc-400">
                                    {t("vault.headerDesc")}
                                </p>) : null}
                        </div>
                    </div>
                    <div className={cn("flex items-center gap-2", compact ? "w-full" : "w-full gap-3 md:w-auto")}>
                        <Button onClick={() => setIsUploadOpen(true)} className={cn("rounded-2xl bg-primary font-black text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90", compact ? "h-11 min-h-[44px] flex-1 px-4 text-sm" : "h-12 flex-1 px-6 md:flex-none")}>
                            <Upload className="mr-2 h-4 w-4"/>
                            {t("vault.upload")}
                        </Button>
                        <Button variant="secondary" size="icon" onClick={refresh} className={cn("rounded-2xl border border-border bg-muted", compact ? "h-11 w-11 shrink-0" : "h-12 w-12")}>
                            <RefreshCw className="h-4 w-4"/>
                        </Button>
                        <Button variant="secondary" size="icon" onClick={() => router.push("/settings?tab=storage")} className={cn("rounded-2xl border border-border bg-muted", compact ? "h-11 w-11 shrink-0" : "h-12 w-12")} aria-label={t("settings.tabs.storage")} title={t("settings.tabs.storage")}>
                            <Settings2 className="h-4 w-4"/>
                        </Button>
                    </div>
                </div>

                <div className={cn("flex min-h-0 flex-1 flex-col", compact ? "space-y-4" : "space-y-8")}>
                    <VaultLegacyMigrationBanner className="shrink-0"/>
                    <div className="flex shrink-0 items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-primary"/>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{t("vault.recentMedia")}</h3>
                    </div>
                    <div data-testid="vault-mobile-scroll-region" className={cn("min-h-0 flex-1", compact && "mobile-scroll-region overflow-y-auto")}>
                        <VaultMediaGrid mediaItems={mediaItems} isLoading={isLoading} stats={stats} refresh={refresh} downloadToLocalPath={downloadToLocalPath} deleteLocalCopy={deleteLocalCopy} openLocalFileLocation={openLocalFileLocation}/>
                    </div>
                </div>
            </div>

            <VaultUploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUploadComplete={() => {
            setTimeout(refresh, 500);
        }}/>
        </PageShell>);
}
