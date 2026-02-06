
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
    pendingAttachments: ReadonlyArray<File>;
    pendingAttachmentPreviewUrls: ReadonlyArray<string>;
    attachmentError: string | null;
    replyTo: ReplyTo | null;
    setReplyTo: (val: ReplyTo | null) => void;
    onPickAttachments: (files: FileList | null) => void;
    removePendingAttachment: (index: number) => void;
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
    pendingAttachments,
    pendingAttachmentPreviewUrls,
    attachmentError,
    replyTo,
    setReplyTo,
    onPickAttachments,
    removePendingAttachment,
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
        <div className="border-t border-black/[0.03] bg-white/80 p-4 safe-bottom dark:border-white/[0.03] dark:bg-black/80 backdrop-blur-xl">
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

            {/* Attachment Preview (Multiple) */}
            {pendingAttachments.length > 0 && (
                <div className="mb-3 flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
                    {pendingAttachments.map((file, index) => (
                        <div key={index} className="relative shrink-0 w-32 group animate-in zoom-in-95 duration-200">
                            <div className="relative rounded-xl overflow-hidden aspect-square border border-black/5 dark:border-white/5 bg-black/5">
                                {file.type.startsWith("image/") ? (
                                    <Image
                                        src={pendingAttachmentPreviewUrls[index]}
                                        alt={file.name}
                                        fill
                                        unoptimized
                                        className="object-cover transition-transform group-hover:scale-110 duration-500"
                                    />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center bg-zinc-200 dark:bg-zinc-800">
                                        <FileText className="h-8 w-8 text-zinc-400" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Button
                                        type="button"
                                        variant="danger"
                                        size="icon"
                                        className="h-8 w-8 rounded-full shadow-lg"
                                        onClick={() => removePendingAttachment(index)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="mt-1 text-[9px] font-medium text-zinc-500 truncate px-1">
                                {file.name}
                            </div>
                        </div>
                    ))}

                    {/* Add More Button */}
                    <button
                        type="button"
                        onClick={() => document.getElementById("composer-attachment")?.click()}
                        className="shrink-0 w-32 aspect-square rounded-xl border-2 border-dashed border-black/5 dark:border-white/10 flex flex-col items-center justify-center hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-zinc-400 hover:text-purple-500 group"
                    >
                        <Paperclip className="h-6 w-6 mb-1 transition-transform group-hover:rotate-12" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{t("common.addMore", "Add More")}</span>
                    </button>
                </div>
            )}

            {attachmentError && (
                <div className="mb-3 text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 uppercase tracking-wide bg-rose-500/10 p-2 rounded-lg">
                    <div className="h-1 w-1 rounded-full bg-current" />
                    {attachmentError}
                    <button onClick={clearPendingAttachment} className="ml-auto underline">Clear All</button>
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
                    multiple
                    className="hidden"
                    id="composer-attachment"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPickAttachments(e.target.files)}
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-12 w-12 rounded-full hover:bg-black/5 dark:hover:bg-white/5 shrink-0 flex items-center justify-center p-0"
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
                            "h-12 w-12 rounded-full hover:bg-black/5 dark:hover:bg-white/5 shrink-0 transition-colors flex items-center justify-center p-0",
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
                    disabled={isGated || (!messageInput.trim() && pendingAttachments.length === 0) || isUploadingAttachment}
                    size="icon"
                    className={cn(
                        "h-11 w-11 rounded-full shrink-0 transition-transform active:scale-95 flex items-center justify-center p-0",
                        (messageInput.trim() || pendingAttachments.length > 0) && !isUploadingAttachment
                            ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                            : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                    )}
                >
                    {isUploadingAttachment ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <Send className="h-5 w-5 translate-x-0.5 mt-[-1px]" />
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
                    {t("messaging.nip04Desc", "E2E Encrypted")} • Ver. 0.4.0
                </div>
            </div>
        </div>
    );
}
