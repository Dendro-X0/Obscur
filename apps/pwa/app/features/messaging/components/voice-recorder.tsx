"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Trash2, Send, Loader2 } from "lucide-react";
import { Button } from "@dweb/ui-kit/button";
import { cn } from "@dweb/ui-kit/cn";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit/toast";
import { logAppEvent } from "@/app/shared/log-app-event";
import { getRuntimeCapabilities } from "@/app/features/runtime/runtime-capabilities";
import {
    getVoiceNoteRecordingCapability,
    type VoiceNoteRecordingCapability,
} from "@/app/features/messaging/services/voice-note-recording-capability";
import {
    requestMediaStream,
    shouldOpenMediaConsentRecovery,
} from "@/app/features/messaging/services/media-device-access";
import { useVoiceRecordingWaveform } from "@/app/features/messaging/hooks/use-voice-recording-waveform";
import { VoiceRecordingWaveform } from "./voice-recording-waveform";
import { MediaDeviceConsentDialog } from "./media-device-consent-dialog";

interface VoiceRecorderProps {
    onRecordingComplete: (file: File) => void;
    isUploading: boolean;
    disabled?: boolean;
    /** Lets the composer swap to a full-row recording chrome. */
    onRecordingChange?: (isRecording: boolean) => void;
}

/**
 * VoiceRecorder component using MediaRecorder API
 */
export function VoiceRecorder({ onRecordingComplete, isUploading, disabled, onRecordingChange }: VoiceRecorderProps) {
    const { t } = useTranslation();
    const [isRecording, setIsRecording] = useState(false);
    const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
    const [consentOpen, setConsentOpen] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [recordingCapability, setRecordingCapability] = useState<VoiceNoteRecordingCapability>(
        () => getVoiceNoteRecordingCapability()
    );
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const recordingDurationSecondsRef = useRef(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const waveformState = useVoiceRecordingWaveform(recordingStream, isRecording);

    const releaseStream = useCallback(() => {
        if (!streamRef.current) {
            setRecordingStream(null);
            return;
        }
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecordingStream(null);
    }, []);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const beginRecordingWithStream = useCallback((stream: MediaStream, preferredMimeType: string | null) => {
        streamRef.current = stream;
        setRecordingStream(stream);
        const recorder = preferredMimeType
            ? new MediaRecorder(stream, { mimeType: preferredMimeType })
            : new MediaRecorder(stream);
        const outputMimeType = recorder.mimeType || preferredMimeType || "audio/webm";
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
    }, [onRecordingComplete, releaseStream, t]);

    const requestConsentOrStart = async () => {
        const capability = getVoiceNoteRecordingCapability();
        setRecordingCapability(capability);
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

        // Always getUserMedia first — WebView owns the prompt. Do not gate on
        // permissions.query (Tauri often mis-reports denied → double dialog).
        const result = await requestMediaStream({ kind: "microphone" });
        if (result.ok) {
            beginRecordingWithStream(result.stream, capability.preferredMimeType);
            return;
        }
        if (shouldOpenMediaConsentRecovery(result.reasonCode)) {
            setConsentOpen(true);
            return;
        }
        toast.error(
            result.reasonCode === "not_found"
                ? (t("messaging.microphoneNotDetected") || "No microphone was detected.")
                : result.reasonCode === "unavailable"
                    ? (t("messaging.microphoneUnavailable") || "Microphone is unavailable.")
                    : (t("messaging.microphoneAccessDenied") || "Microphone access denied"),
        );
    };

    const handleConsentGranted = async (stream: MediaStream): Promise<void> => {
        setConsentOpen(false);
        const capability = getVoiceNoteRecordingCapability();
        beginRecordingWithStream(stream, capability.preferredMimeType);
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
            mediaRecorderRef.current.onstop = null;
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

    useEffect(() => {
        onRecordingChange?.(isRecording);
        return () => {
            onRecordingChange?.(false);
        };
    }, [isRecording, onRecordingChange]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    return (
        <div
            className={cn("flex min-w-0 items-center", isRecording ? "w-full flex-1" : "shrink-0")}
            data-testid="voice-recorder"
            data-recording={isRecording ? "1" : "0"}
        >
            <MediaDeviceConsentDialog
                isOpen={consentOpen}
                kind="microphone"
                purpose="voice_note"
                onClose={() => setConsentOpen(false)}
                onGranted={handleConsentGranted}
            />
            {isRecording ? (
                <div
                    className="flex w-full min-w-0 items-center gap-2 px-0.5 animate-in fade-in duration-200"
                    role="group"
                    aria-label={t("messaging.recordVoiceNote")}
                >
                    <button
                        type="button"
                        onClick={cancelRecording}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-rose-500 transition-colors hover:bg-rose-500/10 dark:hover:bg-rose-400/15"
                        title={t("common.cancel")}
                        aria-label={t("common.cancel")}
                        data-testid="voice-recorder-cancel"
                    >
                        <Trash2 className="h-5 w-5" />
                    </button>

                    <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-rose-500/25 bg-rose-500/5 px-3 dark:border-rose-400/20 dark:bg-rose-400/10">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-70" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
                        </span>
                        <span className="min-w-[2.5rem] shrink-0 font-mono text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                            {formatTime(recordingTime)}
                        </span>
                        <VoiceRecordingWaveform
                            waveform={waveformState}
                            className="min-w-0 max-w-none flex-1"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={stopRecording}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-indigo-500 text-white shadow-[0_0_16px_rgba(168,85,247,0.35)] transition-transform active:scale-95 hover:from-purple-500 hover:to-indigo-400"
                        title={t("common.send")}
                        aria-label={t("common.send")}
                        data-testid="voice-recorder-send"
                    >
                        <Send className="h-4 w-4 translate-x-px" />
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
                    onClick={() => { void requestConsentOrStart(); }}
                    disabled={disabled || isUploading || !recordingCapability.supported}
                    aria-label={t("messaging.recordVoiceNote")}
                    title={recordingCapability.supported
                        ? (t("messaging.recordVoiceNote") || "Record voice note")
                        : (t("messaging.voiceRecordingUnsupported") || "Voice recording unavailable on this runtime")
                    }
                    data-testid="voice-recorder-start"
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
