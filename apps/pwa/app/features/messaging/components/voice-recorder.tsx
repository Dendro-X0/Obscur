"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Trash2, Send, Loader2 } from "lucide-react";
import { Button } from "@dweb/ui-kit";
import { cn } from "@dweb/ui-kit";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import { logAppEvent } from "@/app/shared/log-app-event";
import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";
import {
    getVoiceNoteRecordingCapability,
    type VoiceNoteRecordingCapability,
} from "@/app/features/messaging/services/voice-note-recording-capability";

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
    const [recordingCapability, setRecordingCapability] = useState<VoiceNoteRecordingCapability>(
        () => getVoiceNoteRecordingCapability()
    );
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const recordingDurationSecondsRef = useRef(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const releaseStream = useCallback(() => {
        if (!streamRef.current) {
            return;
        }
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
    }, []);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const classifyStartFailureReasonCode = (error: unknown): string => {
        const name = error instanceof Error ? error.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
            return "microphone_permission_denied";
        }
        if (name === "NotFoundError" || name === "DevicesNotFoundError") {
            return "microphone_not_found";
        }
        if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError") {
            return "microphone_unavailable";
        }
        if (name === "InvalidStateError") {
            return "media_recorder_invalid_state";
        }
        return "recording_start_failed";
    };

    const startRecording = async () => {
        const capability = getVoiceNoteRecordingCapability();
        setRecordingCapability(capability);
        try {
            if (!capability.supported) {
                const runtimeCapabilities = getRuntimeCapabilities();
                logAppEvent({
                    name: "messaging.voice_note.recording_unsupported",
                    level: "warn",
                    scope: { feature: "messaging", action: "voice_note_record" },
                    context: {
                        reasonCode: capability.reasonCode,
                        hasMediaDevices: capability.hasMediaDevices,
                        hasMediaRecorder: capability.hasMediaRecorder,
                        isSecureContext: capability.isSecureContext,
                        isNativeRuntime: runtimeCapabilities.isNativeRuntime,
                    },
                });
                toast.error(t("messaging.voiceRecordingUnsupported") || "Voice recording is unavailable on this runtime");
                return;
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const recorder = capability.preferredMimeType
                ? new MediaRecorder(stream, { mimeType: capability.preferredMimeType })
                : new MediaRecorder(stream);
            const outputMimeType = recorder.mimeType || capability.preferredMimeType || "audio/webm";
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];
            recordingDurationSecondsRef.current = 0;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                if (chunksRef.current.length === 0) {
                    logAppEvent({
                        name: "messaging.voice_note.recording_empty",
                        level: "warn",
                        scope: { feature: "messaging", action: "voice_note_record" },
                        context: {
                            reasonCode: "empty_blob",
                        },
                    });
                    toast.error(t("messaging.voiceRecordingEmpty") || "No audio captured. Please try again.");
                    releaseStream();
                    return;
                }
                const blob = new Blob(chunksRef.current, { type: outputMimeType });
                const durationSeconds = Math.max(0, Math.floor(recordingDurationSecondsRef.current));
                const extension = outputMimeType.includes("ogg")
                    ? "ogg"
                    : outputMimeType.includes("mp4")
                        ? "m4a"
                        : "webm";
                const fileName = `voice-note-${Date.now()}-d${durationSeconds}.${extension}`;
                const file = new File([blob], fileName, { type: outputMimeType });
                logAppEvent({
                    name: "messaging.voice_note.recording_complete",
                    level: "info",
                    scope: { feature: "messaging", action: "voice_note_record" },
                    context: {
                        reasonCode: "completed",
                        durationSeconds,
                        mimeType: outputMimeType,
                        byteLength: blob.size,
                    },
                });
                onRecordingComplete(file);

                // Stop all tracks to release microphone
                releaseStream();
            };

            recorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            recordingDurationSecondsRef.current = 0;
            timerRef.current = setInterval(() => {
                recordingDurationSecondsRef.current += 1;
                setRecordingTime(recordingDurationSecondsRef.current);
            }, 1000);
        } catch (err) {
            const reasonCode = classifyStartFailureReasonCode(err);
            const runtimeCapabilities = getRuntimeCapabilities();
            logAppEvent({
                name: "messaging.voice_note.recording_start_failed",
                level: "warn",
                scope: { feature: "messaging", action: "voice_note_record" },
                context: {
                    reasonCode,
                    errorName: err instanceof Error ? err.name : null,
                    hasMediaDevices: capability.hasMediaDevices,
                    hasMediaRecorder: capability.hasMediaRecorder,
                    isSecureContext: capability.isSecureContext,
                    isNativeRuntime: runtimeCapabilities.isNativeRuntime,
                },
            });
            console.error("Failed to start recording:", err);
            toast.error(t("messaging.microphoneAccessDenied") || "Microphone access denied");
            releaseStream();
            clearTimer();
        }
    };

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearTimer();
        }
    }, [clearTimer, isRecording]);

    const cancelRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.onstop = null; // Prevent file creation
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            clearTimer();
            releaseStream();
            toast.info(t("messaging.recordingCanceled") || "Recording canceled");
        }
    }, [clearTimer, isRecording, releaseStream, t]);

    useEffect(() => {
        return () => {
            clearTimer();
            releaseStream();
        };
    }, [clearTimer, releaseStream]);

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
                    disabled={disabled || isUploading || !recordingCapability.supported}
                    aria-label={t("messaging.recordVoiceNote")}
                    title={recordingCapability.supported
                        ? (t("messaging.recordVoiceNote") || "Record voice note")
                        : (t("messaging.voiceRecordingUnsupported") || "Voice recording unavailable on this runtime")
                    }
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
