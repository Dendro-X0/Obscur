"use client";

import React, { useState } from "react";
import { PageShell } from "../components/page-shell";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import useNavBadges from "@/app/features/main-shell/hooks/use-nav-badges";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { Card, Button } from "@dweb/ui-kit";
import { useRouter } from "next/navigation";
import { IdentityCard } from "../components/identity-card";
import { useTranslation } from "react-i18next";
import { Lock, Upload, RefreshCw, Image as ImageIcon, Settings2 } from "lucide-react";
import { VaultMediaGrid } from "../features/vault/components/vault-media-grid";
import { VaultUploadModal } from "../features/vault/components/vault-upload-modal";
import { useVaultMedia } from "../features/vault/hooks/use-vault-media";

export default function VaultPage(): React.JSX.Element {
    const { t } = useTranslation();
    const router = useRouter();
    const identity = useIdentity();
    const { mediaItems, isLoading, stats, refresh, downloadToLocalPath, deleteLocalCopy } = useVaultMedia();
    const [isUploadOpen, setIsUploadOpen] = useState(false);

    const publicKeyHex: string | null = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
    const navBadges = useNavBadges({ publicKeyHex: (publicKeyHex as PublicKeyHex | null) ?? null });

    if (!publicKeyHex) {
        return (
            <PageShell title={t("nav.vault", "Vault")} navBadgeCounts={navBadges.navBadgeCounts}>
                <div className="mx-auto w-full max-w-3xl p-4">
                    <Card title={t("vault.noIdentity", "Secure Vault")} description={t("vault.noIdentityDesc", "Create an identity to access your encrypted media vault.")} className="w-full">
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

    return (
        <PageShell title={t("nav.vault", "Vault")} navBadgeCounts={navBadges.navBadgeCounts}>
            <div className="mx-auto w-full max-w-7xl p-6 py-8 flex-1 flex flex-col">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-6">
                        <div className="h-20 w-20 rounded-[28px] bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-2xl shadow-primary/20 shrink-0">
                            <Lock className="h-10 w-10 text-white" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">{t("nav.vault", "The Vault")}</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-md font-medium">
                                {t("vault.headerDesc", "Your decentralized, E2EE media storage. Locally aggregated and securely synced.")}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <Button
                            onClick={() => setIsUploadOpen(true)}
                            className="h-12 px-6 rounded-2xl font-black bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all flex-1 md:flex-none"
                        >
                            <Upload className="h-4 w-4 mr-2" />
                            {t("vault.upload", "Secure Upload")}
                        </Button>
                        <Button
                            variant="secondary"
                            size="icon"
                            onClick={refresh}
                            className="h-12 w-12 rounded-2xl bg-muted border border-border"
                        >
                            <RefreshCw className="h-5 w-5" />
                        </Button>
                        <Button
                            variant="secondary"
                            size="icon"
                            onClick={() => router.push("/settings?tab=storage")}
                            className="h-12 w-12 rounded-2xl bg-muted border border-border"
                            aria-label={t("settings.tabs.storage", "Storage")}
                            title={t("settings.tabs.storage", "Storage")}
                        >
                            <Settings2 className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                <div className="space-y-8 flex-1 flex flex-col">
                    <div className="flex items-center gap-3">
                        <ImageIcon className="h-5 w-5 text-primary" />
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">{t("vault.recentMedia", "Recent Media")}</h3>
                    </div>
                    <VaultMediaGrid
                        mediaItems={mediaItems}
                        isLoading={isLoading}
                        stats={stats}
                        refresh={refresh}
                        downloadToLocalPath={downloadToLocalPath}
                        deleteLocalCopy={deleteLocalCopy}
                    />
                </div>
            </div>

            <VaultUploadModal
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                onUploadComplete={() => {
                    setTimeout(refresh, 500);
                }}
            />
        </PageShell>
    );
}
