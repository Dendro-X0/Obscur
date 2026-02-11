"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Trash2, Send, Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/lib/cn";
import { useTranslation } from "react-i18next";
import { toast } from "@/app/components/ui/toast";

interface VoiceRecorderProps {
    onRecordingComplete: (file: File) => void;
    isUploading: boolean;
    disabled?: boolean;
}

/**
 * VoiceRecorder component using MediaRecorder API
 */
export function VoiceRecorder({ onRecordingComplete, isUploading, disabled }: VoiceRecorderProps) {
    const { t } = useTranslation();
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                const file = new File([blob], `voice-note-${Date.now()}.webm`, { type: "audio/webm" });
                onRecordingComplete(file);

                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Failed to start recording:", err);
            toast.error(t("messaging.microphoneAccessDenied") || "Microphone access denied");
        }
    };

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }
    }, [isRecording]);

    const cancelRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = null; // Prevent file creation
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            toast.info(t("messaging.recordingCanceled") || "Recording canceled");
        }
    }, [isRecording, t]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <div className="flex items-center gap-2">
            {isRecording ? (
                <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 border border-purple-500/30 px-4 py-1.5 rounded-full shadow-lg animate-in slide-in-from-right-2 duration-300">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                        <span className="text-xs font-black font-mono tabular-nums">{formatTime(recordingTime)}</span>
                    </div>

                    <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800" />

                    <button
                        onClick={cancelRecording}
                        className="p-1 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-500 rounded-full transition-colors"
                        title={t("common.cancel")}
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>

                    <button
                        onClick={stopRecording}
                        className="p-1.5 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-transform active:scale-90"
                        title={t("common.send")}
                    >
                        <Send className="h-3.5 w-3.5" />
                    </button>
                </div>
            ) : (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "h-12 w-12 rounded-full hover:bg-black/5 dark:hover:bg-white/5 shrink-0 transition-all",
                        disabled && "opacity-50 grayscale cursor-not-allowed"
                    )}
                    onClick={startRecording}
                    disabled={disabled || isUploading}
                    aria-label={t("messaging.recordVoiceNote")}
                >
                    {isUploading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                    ) : (
                        <Mic className="h-5 w-5 text-zinc-500" />
                    )}
                </Button>
            )}
        </div>
    );
}
