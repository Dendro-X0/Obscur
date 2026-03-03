"use client";

import React, { useState } from "react";
import { PageShell } from "../components/page-shell";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import useNavBadges from "@/app/features/main-shell/hooks/use-nav-badges";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { Card, Button, Input, Label, toast } from "@dweb/ui-kit";
import { useRouter } from "next/navigation";
import { IdentityCard } from "../components/identity-card";
import { useTranslation } from "react-i18next";
import { Lock, Upload, RefreshCw, Image as ImageIcon, FolderOpen, Trash2 } from "lucide-react";
import { VaultMediaGrid } from "../features/vault/components/vault-media-grid";
import { VaultUploadModal } from "../features/vault/components/vault-upload-modal";
import { useVaultMedia } from "../features/vault/hooks/use-vault-media";
import {
    getLocalMediaStorageAbsolutePath,
    getLocalMediaStorageConfig,
    openLocalMediaStoragePath,
    purgeLocalMediaCache,
    saveLocalMediaStorageConfig,
    type LocalMediaStorageConfig
} from "../features/vault/services/local-media-store";

export default function VaultPage(): React.JSX.Element {
    const { t } = useTranslation();
    const router = useRouter();
    const identity = useIdentity();
    const { mediaItems, isLoading, stats, refresh, deleteLocalCopy } = useVaultMedia();
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [localConfig, setLocalConfig] = useState<LocalMediaStorageConfig>(() => getLocalMediaStorageConfig());
    const [resolvedPath, setResolvedPath] = useState<string>("");
    const [isResolvingPath, setIsResolvingPath] = useState(false);

    const refreshResolvedPath = async (): Promise<void> => {
        setIsResolvingPath(true);
        try {
            const value = await getLocalMediaStorageAbsolutePath();
            setResolvedPath(value || "");
        } finally {
            setIsResolvingPath(false);
        }
    };

    React.useEffect(() => {
        void refreshResolvedPath();
    }, [localConfig.subdir]);

    const saveConfig = (nextConfig: LocalMediaStorageConfig): void => {
        const normalized = saveLocalMediaStorageConfig(nextConfig);
        setLocalConfig(normalized);
    };

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
            <div className="mx-auto w-full max-w-7xl p-6 py-8">
                {/* Premium Vault Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-6">
                        <div className="h-20 w-20 rounded-[28px] bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shadow-2xl shadow-primary/20 shrink-0">
                            <Lock className="h-10 w-10 text-white" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-3xl font-black tracking-tight">{t("nav.vault", "The Vault")}</h2>
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
                    </div>
                </div>

                {/* Media Section */}
                <div className="space-y-8">
                    <Card title={t("vault.localStorage", "Local Vault Storage")} description={t("vault.localStorageDesc", "Local-first encrypted cache path and retention controls.")}>
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="vault-storage-subdir">{t("vault.localFolderName", "Local data folder name (inside app data)")}</Label>
                                <Input
                                    id="vault-storage-subdir"
                                    value={localConfig.subdir}
                                    onChange={(e) => saveConfig({ ...localConfig, subdir: e.target.value })}
                                    placeholder="vault-media"
                                />
                                <p className="text-xs text-zinc-500">{isResolvingPath ? "Resolving path..." : (resolvedPath || "Path resolves in desktop runtime.")}</p>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={localConfig.enabled}
                                        onChange={(e) => saveConfig({ ...localConfig, enabled: e.target.checked })}
                                    />
                                    {t("vault.localCacheEnabled", "Enable local cache")}
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={localConfig.cacheSentFiles}
                                        onChange={(e) => saveConfig({ ...localConfig, cacheSentFiles: e.target.checked })}
                                    />
                                    {t("vault.cacheSent", "Cache sent files")}
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={localConfig.cacheReceivedFiles}
                                        onChange={(e) => saveConfig({ ...localConfig, cacheReceivedFiles: e.target.checked })}
                                    />
                                    {t("vault.cacheReceived", "Cache received files")}
                                </label>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button type="button" variant="secondary" onClick={() => void openLocalMediaStoragePath()}>
                                    <FolderOpen className="h-4 w-4 mr-2" />
                                    {t("vault.openLocalFolder", "Open Local Folder")}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={async () => {
                                        await purgeLocalMediaCache();
                                        await refresh();
                                        toast.success(t("vault.localCacheCleared", "Local cache cleared."));
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {t("vault.clearLocalCache", "Clear Local Cache")}
                                </Button>
                                <Button type="button" variant="ghost" onClick={() => void refreshResolvedPath()}>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    {t("common.refresh", "Refresh")}
                                </Button>
                            </div>
                        </div>
                    </Card>

                    <div className="flex items-center gap-3">
                        <ImageIcon className="h-5 w-5 text-primary" />
                        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">{t("vault.recentMedia", "Recent Media")}</h3>
                    </div>
                    <VaultMediaGrid
                        mediaItems={mediaItems}
                        isLoading={isLoading}
                        stats={stats}
                        refresh={refresh}
                        deleteLocalCopy={deleteLocalCopy}
                    />
                </div>
            </div>

            <VaultUploadModal
                isOpen={isUploadOpen}
                onClose={() => setIsUploadOpen(false)}
                onUploadComplete={() => {
                    // Small delay to ensure IndexedDB sync if we were saving to it
                    setTimeout(refresh, 500);
                }}
            />
        </PageShell>
    );
}
