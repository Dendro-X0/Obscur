
import React from "react";
import Image from "next/image";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import { cn } from "@/app/lib/utils";
import { useTranslation } from "react-i18next";
import { Paperclip, Send, X, FileText, Loader2, Smile } from "lucide-react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
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
    const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
    const emojiPickerRef = React.useRef<HTMLDivElement>(null);

    // Auto-resize logic
    React.useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        // Reset height to calculate correctly
        textarea.style.height = "auto";
        const newHeight = Math.min(textarea.scrollHeight, 192); // Max height 192px (~8 lines)
        textarea.style.height = `${newHeight}px`;
    }, [messageInput, textareaRef]);

    // Close emoji picker when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };

        if (showEmojiPicker) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showEmojiPicker]);

    const onEmojiClick = (emojiData: EmojiClickData) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = messageInput;
        const before = text.substring(0, start);
        const after = text.substring(end);

        setMessageInput(before + emojiData.emoji + after);

        // Focus back after state update
        setTimeout(() => {
            textarea.focus();
            const newPos = start + emojiData.emoji.length;
            textarea.setSelectionRange(newPos, newPos);
        }, 0);
    };

    return (
        <div className="border-t border-black/[0.03] bg-white/80 p-4 pb-safe dark:border-white/[0.03] dark:bg-black/80 backdrop-blur-xl">
            {/* Connection Pending Gated State */}
            {isGated && (
                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-purple-500/20 bg-purple-50/50 p-4 text-[11px] font-medium text-purple-700 dark:border-purple-500/30 dark:bg-purple-900/20 dark:text-purple-300 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                    <p>Connection request pending. Accept to start messaging.</p>
                </div>
            )}

            {/* Recipient Not Found Warning */}
            {recipientStatus === 'not_found' && !isGated && (
                <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-50/50 p-4 text-[11px] font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-300 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="mt-0.5 h-4 w-4 shrink-0 text-amber-500">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    </div>
                    <p>Recipient profile not found on your relays. Delivery might be unreliable.</p>
                </div>
            )}

            {/* Reply Panel */}
            {replyTo && (
                <div className="mb-3 overflow-hidden rounded-2xl border border-black/5 bg-zinc-50/80 dark:border-white/5 dark:bg-zinc-900/80 animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0 flex-1 flex items-center gap-2 border-l-2 border-purple-500 pl-3">
                            <div className="truncate">
                                <div className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">{t("messaging.replyingTo")}</div>
                                <div className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-400 italic">{replyTo.previewText}</div>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
                            onClick={() => setReplyTo(null)}
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Attachment Preview */}
            {pendingAttachment && (
                <div className="mb-3 overflow-hidden rounded-2xl border border-black/5 bg-zinc-50/80 dark:border-white/5 dark:bg-zinc-900/80 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="p-3">
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="h-8 w-8 rounded-lg bg-white dark:bg-zinc-800 flex items-center justify-center border border-black/5 dark:border-white/5 shrink-0">
                                    <FileText className="h-4 w-4 text-zinc-400" />
                                </div>
                                <div className="truncate">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Attachment</div>
                                    <div className="text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate">{pendingAttachment.name}</div>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                className="h-8 px-3 rounded-xl text-[10px] font-bold"
                                onClick={clearPendingAttachment}
                            >
                                {t("common.remove", "Remove")}
                            </Button>
                        </div>

                        {pendingAttachmentPreviewUrl && (
                            <div className="relative rounded-xl overflow-hidden border border-black/5 dark:border-white/5 bg-black/5">
                                {pendingAttachment.type.startsWith("image/") ? (
                                    <Image
                                        src={pendingAttachmentPreviewUrl}
                                        alt={pendingAttachment.name}
                                        width={800}
                                        height={600}
                                        unoptimized
                                        className="max-h-60 w-full object-contain"
                                    />
                                ) : (
                                    <video src={pendingAttachmentPreviewUrl} controls className="max-h-60 w-full" />
                                )}
                            </div>
                        )}

                        {attachmentError && (
                            <div className="mt-2 text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 uppercase tracking-wide">
                                <div className="h-1 w-1 rounded-full bg-current" />
                                {attachmentError}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Main Input Area */}
            <div className={cn(
                "relative flex items-end gap-2 p-1.5 bg-zinc-100/80 dark:bg-zinc-900/80 rounded-[28px] ring-1 ring-black/[0.03] dark:ring-white/[0.03] transition-all duration-300",
                "focus-within:bg-white dark:focus-within:bg-zinc-900 focus-within:ring-purple-500/20 focus-within:shadow-xl focus-within:shadow-purple-500/5",
                isGated && "opacity-50 grayscale pointer-events-none"
            )}>
                <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    id="composer-attachment"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPickAttachment(e.target.files?.[0] ?? null)}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full hover:bg-black/5 dark:hover:bg-white/5 shrink-0"
                    disabled={isUploadingAttachment || isGated}
                    onClick={() => document.getElementById("composer-attachment")?.click()}
                >
                    <Paperclip className="h-5 w-5 text-zinc-500" />
                </Button>

                <Textarea
                    placeholder={isGated ? "Connection pending..." : t("messaging.typeAMessage")}
                    ref={textareaRef}
                    value={messageInput}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessageInput(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                        if (isGated) return;
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                        }
                    }}
                    disabled={isGated}
                    className="min-h-[40px] flex-1 resize-none border-0 bg-transparent py-2.5 text-sm leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-zinc-400 overflow-y-auto"
                    rows={1}
                />

                <div className="relative flex items-center">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-10 w-10 rounded-full hover:bg-black/5 dark:hover:bg-white/5 shrink-0 transition-colors",
                            showEmojiPicker && "bg-black/5 dark:bg-white/5 text-purple-600"
                        )}
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        disabled={isGated}
                    >
                        <Smile className="h-5 w-5 text-zinc-500" />
                    </Button>

                    {showEmojiPicker && (
                        <div
                            ref={emojiPickerRef}
                            className="absolute bottom-full right-0 mb-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
                        >
                            <EmojiPicker
                                onEmojiClick={onEmojiClick}
                                autoFocusSearch={false}
                                theme={Theme.AUTO}
                                width={320}
                                height={400}
                                skinTonesDisabled
                                searchPlaceHolder="Search emojis..."
                            />
                        </div>
                    )}
                </div>

                <Button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={isGated || (!messageInput.trim() && !pendingAttachment) || isUploadingAttachment}
                    size="icon"
                    className={cn(
                        "h-10 w-10 rounded-full shrink-0 transition-transform active:scale-90",
                        (messageInput.trim() || pendingAttachment) && !isUploadingAttachment
                            ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                            : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                    )}
                >
                    {isUploadingAttachment ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <Send className="h-5 w-5" />
                    )}
                </Button>
            </div>

            {/* Footer Status */}
            <div className="mt-3 flex items-center justify-between px-2 opacity-50">
                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    <span className="flex items-center gap-1.5">
                        <div className={cn("h-1.5 w-1.5 rounded-full", relayStatus.openCount > 0 ? "bg-emerald-500" : "bg-rose-500")} />
                        {t("messaging.connectedToRelays", { open: relayStatus.openCount, total: relayStatus.total })}
                    </span>
                </div>
                <div className="text-[9px] font-medium text-zinc-400 uppercase tracking-tight">
                    {t("messaging.nip04Desc", "E2E Encrypted")} • Ver. 0.3.6.1
                </div>
            </div>
        </div>
    );
}
