"use client";

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    Button
} from "@dweb/ui-kit";
import {
    Upload,
    Cloud,
    FileIcon,
    CheckCircle2,
    AlertCircle,
    LoaderIcon,
    Globe
} from "lucide-react";
import { RECOMMENDED_STORAGE_PROVIDERS, type StorageProvider } from "../../messaging/lib/storage-providers";
import { Nip96UploadService } from "../../messaging/lib/nip96-upload-service";
import { useIdentity } from "../../auth/hooks/use-identity";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

interface VaultUploadModalProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onUploadComplete?: (url: string) => void;
}

export function VaultUploadModal({ isOpen, onClose, onUploadComplete }: VaultUploadModalProps) {
    const { t } = useTranslation();
    const identity = useIdentity();
    const [selectedProvider, setSelectedProvider] = useState<StorageProvider | null>(RECOMMENDED_STORAGE_PROVIDERS[0] || null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successUrl, setSuccessUrl] = useState<string | null>(null);

    const publicKeyHex = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
    const privateKeyHex = identity.state.privateKeyHex ?? null;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedProvider) return;

        setIsUploading(true);
        setError(null);
        setSuccessUrl(null);

        try {
            const uploadService = new Nip96UploadService(
                [selectedProvider.url],
                publicKeyHex,
                privateKeyHex
            );

            const attachment = await uploadService.uploadFile(file);
            setSuccessUrl(attachment.url);
            onUploadComplete?.(attachment.url);
        } catch (err: any) {
            console.error("[VaultUpload] Upload failed:", err);
            setError(err.message || "Upload failed. Please try another provider or check your connection.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="relative w-full max-w-lg bg-background border border-border shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
                    >
                        <div className="p-6 sm:p-8 overflow-y-auto scrollbar-immersive">
                            <div className="flex flex-col gap-2 text-center sm:text-left">
                                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-2 mx-auto sm:mx-0">
                                    <Cloud className="h-8 w-8 text-primary" />
                                </div>
                                <h2 className="text-2xl font-black">{t("vault.uploadTitle", "Secure Cloud Upload")}</h2>
                                <p className="text-sm text-muted-foreground font-medium">
                                    {t("vault.uploadDesc", "Upload your files to an encrypted NIP-96 storage provider.")}
                                </p>
                            </div>

                            <div className="pt-6">
                                {!successUrl ? (
                                    <div className="space-y-6">
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">
                                                {t("vault.selectProvider", "Select Storage Provider")}
                                            </h4>
                                            <div className="grid grid-cols-1 gap-3">
                                                {RECOMMENDED_STORAGE_PROVIDERS.map((provider) => (
                                                    <div
                                                        key={provider.name}
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => setSelectedProvider(provider)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') setSelectedProvider(provider); }}
                                                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${selectedProvider?.name === provider.name
                                                            ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                                                            : "border-border hover:border-border/80 hover:bg-accent/50"
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${selectedProvider?.name === provider.name ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                                                }`}>
                                                                <Globe className="h-5 w-5" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-foreground">{provider.name}</p>
                                                                <p className="text-[10px] text-muted-foreground font-medium">{provider.description}</p>
                                                            </div>
                                                        </div>
                                                        {selectedProvider?.name === provider.name && (
                                                            <CheckCircle2 className="h-5 w-5 text-primary" />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <input
                                                type="file"
                                                id="vault-file-upload"
                                                className="hidden"
                                                onChange={handleFileUpload}
                                                disabled={isUploading}
                                            />
                                            <Button
                                                asChild
                                                className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90"
                                                disabled={isUploading}
                                            >
                                                <label htmlFor="vault-file-upload" className="cursor-pointer flex items-center justify-center gap-3">
                                                    {isUploading ? (
                                                        <LoaderIcon className="h-5 w-5 animate-spin" />
                                                    ) : (
                                                        <Upload className="h-5 w-5" />
                                                    )}
                                                    {isUploading ? t("common.uploading", "Uploading...") : t("vault.chooseFile", "Choose File")}
                                                </label>
                                            </Button>

                                            {error && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                                                    className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive"
                                                >
                                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                                    <p className="text-xs font-bold leading-tight">{error}</p>
                                                </motion.div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex flex-col items-center justify-center py-6 text-center space-y-6"
                                    >
                                        <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center border-4 border-emerald-500/5">
                                            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-black">{t("vault.uploadSuccess", "Securely Saved!")}</h3>
                                            <p className="text-sm text-muted-foreground px-6">{t("vault.successDesc", "Your file is now stored in your personal vault.")}</p>
                                        </div>
                                        <div className="w-full">
                                            <div className="p-4 rounded-2xl bg-muted border border-border flex items-center gap-3">
                                                <FileIcon className="h-5 w-5 text-primary shrink-0" />
                                                <p className="text-[10px] font-mono truncate text-muted-foreground break-all text-left">{successUrl}</p>
                                            </div>
                                        </div>
                                        <Button onClick={onClose} className="w-full h-12 rounded-2xl font-black">
                                            {t("common.done", "Close")}
                                        </Button>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
