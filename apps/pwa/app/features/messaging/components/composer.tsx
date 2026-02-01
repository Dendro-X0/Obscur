
import React from "react";
import Image from "next/image";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import { useTranslation } from "react-i18next";
import type { ReplyTo, RelayStatusSummary } from "../types";

interface ComposerProps {
    messageInput: string;
    setMessageInput: (val: string) => void;
    handleSendMessage: () => void;
    isUploadingAttachment: boolean;
    pendingAttachment: File | null;
    pendingAttachmentPreviewUrl: string | null;
    attachmentError: string | null;
    replyTo: ReplyTo | null;
    setReplyTo: (val: ReplyTo | null) => void;
    onPickAttachment: (file: File | null) => void;
    clearPendingAttachment: () => void;
    relayStatus: RelayStatusSummary;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    recipientStatus?: 'idle' | 'found' | 'not_found' | 'verifying';
    isPeerAccepted?: boolean;
}

export function Composer({
    messageInput,
    setMessageInput,
    handleSendMessage,
    isUploadingAttachment,
    pendingAttachment,
    pendingAttachmentPreviewUrl,
    attachmentError,
    replyTo,
    setReplyTo,
    onPickAttachment,
    clearPendingAttachment,
    relayStatus,
    textareaRef,
    recipientStatus,
    isPeerAccepted = true
}: ComposerProps) {
    const { t } = useTranslation();
    const isGated: boolean = isPeerAccepted === false;

    return (
        <div className="border-t border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black">
            {isGated ? (
                <div className="mb-3 flex items-start gap-3 rounded-xl border border-purple-500/30 bg-purple-50 p-3 text-xs text-purple-700 dark:border-purple-500/40 dark:bg-purple-950/40 dark:text-purple-300">
                    <div>
                        <p className="font-semibold">Connection request pending.</p>
                        <p>Accept this user to enable messaging.</p>
                    </div>
                </div>
            ) : null}
            {recipientStatus === 'not_found' && (
                <div className="mb-3 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300">
                    <div className="mt-0.5 h-4 w-4 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    </div>
                    <div>
                        <p className="font-semibold">Recipient profile not found.</p>
                        <p>This user hasn&apos;t published a profile on your connected relays. Delivery might be unreliable.</p>
                    </div>
                </div>
            )}
            {replyTo ? (
                <div className="mb-3 rounded-xl border border-black/10 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-950/60">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{t("messaging.replyingTo")}</div>
                            <div className="mt-1 truncate text-xs text-zinc-600 dark:text-zinc-400">{replyTo.previewText}</div>
                        </div>
                        <Button type="button" variant="secondary" onClick={() => setReplyTo(null)}>
                            {t("common.cancel")}
                        </Button>
                    </div>
                </div>
            ) : null}
            <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                id="composer-attachment"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPickAttachment(e.target.files?.[0] ?? null)}
            />
            {pendingAttachment ? (
                <div className="mb-3 rounded-xl border border-black/10 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-950/60">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Attachment</div>
                            <div className="mt-1 truncate text-xs font-mono text-zinc-600 dark:text-zinc-400">{pendingAttachment.name}</div>
                            {pendingAttachmentPreviewUrl ? (
                                pendingAttachment.type.startsWith("image/") ? (
                                    <Image src={pendingAttachmentPreviewUrl} alt={pendingAttachment.name} width={640} height={480} unoptimized className="mt-2 max-h-40 w-auto rounded-lg" />
                                ) : (
                                    <video src={pendingAttachmentPreviewUrl} controls className="mt-2 max-h-40 w-auto rounded-lg" />
                                )
                            ) : null}
                        </div>
                        <Button type="button" variant="secondary" onClick={clearPendingAttachment}>
                            Remove
                        </Button>
                    </div>
                    {attachmentError ? (
                        <div className="mt-2 text-xs text-red-600 dark:text-red-400">{attachmentError}</div>
                    ) : null}
                </div>
            ) : attachmentError ? (
                <div className="mb-3 rounded-xl border border-red-500/30 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-300">
                    {attachmentError}
                </div>
            ) : null}
            <div className="rounded-2xl border border-black/10 bg-white/80 p-2 shadow-sm ring-1 ring-black/3 focus-within:ring-2 focus-within:ring-zinc-400/50 dark:border-white/10 dark:bg-zinc-950/40 dark:ring-white/4 dark:shadow-black/40 dark:focus-within:ring-zinc-400/50">
                <div className="flex items-end gap-2">
                    <label htmlFor="composer-attachment">
                        <Button type="button" variant="secondary" disabled={isUploadingAttachment}>
                            Attach
                        </Button>
                    </label>
                    <Textarea
                        placeholder={t("messaging.typeAMessage")}
                        ref={textareaRef}
                        value={messageInput}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessageInput(e.target.value)}
                        onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                            if (isGated) {
                                e.preventDefault();
                                return;
                            }
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        disabled={isGated}
                        className="min-h-11 max-h-32 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                        rows={1}
                    />
                    <Button type="button" onClick={handleSendMessage} disabled={isGated || (!messageInput.trim() && !pendingAttachment) || isUploadingAttachment} className="shrink-0">
                        {isUploadingAttachment ? t("messaging.uploading") : t("common.send")}
                    </Button>
                </div>
                <div className="mt-1 px-1 text-[11px] leading-5 text-zinc-600 dark:text-zinc-400">
                    {t("messaging.enterToSend")}
                </div>
            </div>
            <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{t("messaging.connectedToRelays", { open: relayStatus.openCount, total: relayStatus.total })}</div>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{t("messaging.nip04Desc")}</p>
        </div>
    );
}
