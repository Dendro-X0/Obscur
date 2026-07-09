"use client";
import React, { useRef, useState } from "react";
import { Button, toast } from "@dweb/ui-kit";
import { Upload, Cloud, FileIcon, CheckCircle2, AlertCircle, LoaderIcon, Globe, HardDrive, Lock } from "lucide-react";
import {
    LOCAL_VAULT_STORAGE_PROVIDER,
    RECOMMENDED_STORAGE_PROVIDERS,
    isLocalVaultStorageProvider,
    type StorageProvider,
} from "../../messaging/lib/storage-providers";
import { Nip96UploadService } from "../../messaging/lib/nip96-upload-service";
import { useIdentity } from "../../auth/hooks/use-identity";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { cacheAttachmentLocally, saveFileToLocalVault } from "../services/local-media-store";
import { VaultWriteEncryptionRequiredError } from "@/app/features/storage/services/vault-at-rest";
import { getUploadFailureUserMessageFromUnknown } from "../../messaging/lib/upload-user-copy";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

const VAULT_STORAGE_PROVIDERS: ReadonlyArray<StorageProvider> = hasNativeRuntime()
    ? [LOCAL_VAULT_STORAGE_PROVIDER, ...RECOMMENDED_STORAGE_PROVIDERS]
    : RECOMMENDED_STORAGE_PROVIDERS;

interface VaultUploadModalProps {
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly onUploadComplete?: (url: string) => void;
}
export function VaultUploadModal({ isOpen, onClose, onUploadComplete }: VaultUploadModalProps) {
    const { t } = useTranslation();
    const identity = useIdentity();
    const [selectedProvider, setSelectedProvider] = useState<StorageProvider | null>(
        VAULT_STORAGE_PROVIDERS[0] || null,
    );
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successUrl, setSuccessUrl] = useState<string | null>(null);
    const [savedLocally, setSavedLocally] = useState(false);
    const pendingFilesRef = useRef<File[]>([]);
    const publicKeyHex = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
    const privateKeyHex = identity.state.privateKeyHex ?? null;
    const canSaveLocally = hasNativeRuntime();

    const saveFilesLocally = async (files: File[]): Promise<boolean> => {
        if (!canSaveLocally || files.length === 0) {
            return false;
        }
        let lastVaultUrl: string | null = null;
        let successCount = 0;
        for (const file of files) {
            try {
                const result = await saveFileToLocalVault(file);
                if (!result) {
                    continue;
                }
                lastVaultUrl = result.vaultUrl;
                successCount += 1;
                onUploadComplete?.(result.vaultUrl);
            } catch (err) {
                if (err instanceof VaultWriteEncryptionRequiredError) {
                    throw err;
                }
                console.error("[VaultUpload] Failed to save file locally:", file.name, err);
            }
        }
        if (successCount === 0) {
            return false;
        }
        if (successCount < files.length) {
            toast.warning(t("vault.partialLocalSave", { saved: successCount, total: files.length }));
        }
        setSavedLocally(true);
        setSuccessUrl(lastVaultUrl);
        setError(null);
        return true;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0 || !selectedProvider) {
            return;
        }
        pendingFilesRef.current = files;
        setIsUploading(true);
        setError(null);
        setSuccessUrl(null);
        setSavedLocally(false);

        if (isLocalVaultStorageProvider(selectedProvider)) {
            try {
                const saved = await saveFilesLocally(files);
                if (!saved) {
                    throw new Error(t("vault.localSaveFailed"));
                }
            } catch (err: unknown) {
                console.error("[VaultUpload] Local save failed:", err);
                if (err instanceof VaultWriteEncryptionRequiredError) {
                    setError(t("vault.localSaveUnlockRequired"));
                } else {
                    setError(err instanceof Error ? err.message : t("vault.localSaveFailed"));
                }
            } finally {
                setIsUploading(false);
            }
            return;
        }

        let lastUploadedUrl: string | null = null;
        let successCount = 0;
        try {
            const uploadService = new Nip96UploadService([selectedProvider.url], publicKeyHex, privateKeyHex);
            for (const file of files) {
                try {
                    const attachment = await uploadService.uploadFile(file);
                    const bytes = new Uint8Array(await file.arrayBuffer());
                    void cacheAttachmentLocally(attachment, "sent", bytes, { force: true });
                    lastUploadedUrl = attachment.url;
                    successCount++;
                    onUploadComplete?.(attachment.url);
                }
                catch (err) {
                    console.error("[VaultUpload] Failed to upload file:", file.name, err);
                }
            }
            if (successCount === 0) {
                throw new Error("All files failed to upload.");
            }
            if (successCount < files.length) {
                setError(`Only ${successCount} of ${files.length} files uploaded successfully.`);
            }
            setSuccessUrl(lastUploadedUrl);
        }
        catch (err: unknown) {
            console.error("[VaultUpload] Upload failed:", err);
            setError(getUploadFailureUserMessageFromUnknown(err, "Upload failed. Please try another provider or check your connection."));
        }
        finally {
            setIsUploading(false);
        }
    };

    const handleSaveLocallyFallback = async () => {
        const files = pendingFilesRef.current;
        if (files.length === 0) {
            setError(t("vault.localSaveRetryNoFiles"));
            return;
        }
        setIsUploading(true);
        try {
            const saved = await saveFilesLocally(files);
            if (!saved) {
                setError(t("vault.localSaveFailed"));
            }
        } finally {
            setIsUploading(false);
        }
    };

    return (<AnimatePresence>
            {isOpen && (<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm"/>
                    <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -20 }} transition={{ duration: 0.2, ease: "easeOut" }} className="relative w-full max-w-lg bg-background border border-border shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 sm:p-8 overflow-y-auto scrollbar-immersive">
                            <div className="flex flex-col gap-2 text-center sm:text-left">
                                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-2 mx-auto sm:mx-0">
                                    {savedLocally ? (<Lock className="h-8 w-8 text-primary"/>) : (<Cloud className="h-8 w-8 text-primary"/>)}
                                </div>
                                <h2 className="text-2xl font-black">{t("vault.uploadTitle")}</h2>
                                <p className="text-sm text-muted-foreground font-medium">
                                    {t("vault.uploadDesc")}
                                </p>
                            </div>

                            <div className="pt-6">
                                {!successUrl ? (<div className="space-y-6">
                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-1">
                                                {t("vault.selectProvider")}
                                            </h4>
                                            <div className="grid grid-cols-1 gap-3">
                                                {VAULT_STORAGE_PROVIDERS.map((provider) => (<div key={provider.name} role="button" tabIndex={0} onClick={() => setSelectedProvider(provider)} onKeyDown={(e) => { if (e.key === 'Enter')
                    setSelectedProvider(provider); }} className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${selectedProvider?.name === provider.name
                        ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                        : "border-border hover:border-border/80 hover:bg-accent/50"}`}>
                                                        <div className="flex items-center gap-4">
                                                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${selectedProvider?.name === provider.name ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                                                                {isLocalVaultStorageProvider(provider)
                        ? (<HardDrive className="h-5 w-5"/>)
                        : (<Globe className="h-5 w-5"/>)}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-foreground">{provider.name}</p>
                                                                <p className="text-[10px] text-muted-foreground font-medium">{provider.description}</p>
                                                            </div>
                                                        </div>
                                                        {selectedProvider?.name === provider.name && (<CheckCircle2 className="h-5 w-5 text-primary"/>)}
                                                    </div>))}
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <input type="file" id="vault-file-upload" className="hidden" multiple onChange={handleFileUpload} disabled={isUploading}/>
                                            <Button asChild className="w-full h-14 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90" disabled={isUploading}>
                                                <label htmlFor="vault-file-upload" className="cursor-pointer flex items-center justify-center gap-3">
                                                    {isUploading ? (<LoaderIcon className="h-5 w-5 animate-spin"/>) : (<Upload className="h-5 w-5"/>)}
                                                    {isUploading ? t("common.uploading") : t("vault.chooseFile")}
                                                </label>
                                            </Button>

                                            {error && (<motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
                                                    <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive">
                                                        <AlertCircle className="h-4 w-4 shrink-0"/>
                                                        <p className="text-xs font-bold leading-tight">{error}</p>
                                                    </div>
                                                    {canSaveLocally ? (<Button type="button" variant="secondary" className="w-full h-12 rounded-2xl font-black" disabled={isUploading} onClick={() => void handleSaveLocallyFallback()}>
                                                            <HardDrive className="mr-2 h-4 w-4"/>
                                                            {t("vault.saveLocallyInstead")}
                                                        </Button>) : null}
                                                </motion.div>)}
                                        </div>
                                    </div>) : (<motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-6 text-center space-y-6">
                                        <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center border-4 border-emerald-500/5">
                                            <CheckCircle2 className="h-12 w-12 text-emerald-500"/>
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-black">{t("vault.uploadSuccess")}</h3>
                                            <p className="text-sm text-muted-foreground px-6">
                                                {savedLocally ? t("vault.localSuccessDesc") : t("vault.successDesc")}
                                            </p>
                                        </div>
                                        <div className="w-full">
                                            <div className="p-4 rounded-2xl bg-muted border border-border flex items-center gap-3">
                                                <FileIcon className="h-5 w-5 text-primary shrink-0"/>
                                                <p className="text-[10px] font-mono truncate text-muted-foreground break-all text-left">{successUrl}</p>
                                            </div>
                                        </div>
                                        <Button onClick={onClose} className="w-full h-12 rounded-2xl font-black">
                                            {t("common.done")}
                                        </Button>
                                    </motion.div>)}
                            </div>
                        </div>
                    </motion.div>
                </div>)}
        </AnimatePresence>);
}
