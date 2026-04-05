"use client";

import imageCompression from "browser-image-compression";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { AttachmentKind } from "../types";

let ffmpeg: FFmpeg | null = null;
const FFMPEG_CORE_LOAD_TIMEOUT_MS = 8_000;
const FFMPEG_TRANSCODE_TIMEOUT_MS = 60_000;
const VIDEO_THUMBNAIL_TIMEOUT_MS = 8_000;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(new Error(`${label} timed out after ${timeoutMs}ms`));
                }, timeoutMs);
            })
        ]);
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    }
};

/**
 * Initialize and load FFmpeg if not already loaded
 */
async function loadFFmpeg(): Promise<FFmpeg> {
    if (ffmpeg) return ffmpeg;

    ffmpeg = new FFmpeg();

    // We need to load the worker and wasm files
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    const coreURL = await withTimeout(
        toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        FFMPEG_CORE_LOAD_TIMEOUT_MS,
        "FFmpeg core script load"
    );
    const wasmURL = await withTimeout(
        toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        FFMPEG_CORE_LOAD_TIMEOUT_MS,
        "FFmpeg wasm load"
    );
    await withTimeout(
        ffmpeg.load({ coreURL, wasmURL }),
        FFMPEG_CORE_LOAD_TIMEOUT_MS,
        "FFmpeg initialization"
    );

    return ffmpeg;
}

/**
 * Compress an image file
 */
export async function compressImage(file: File): Promise<File> {
    const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 0.8,
    };

    try {
        return await imageCompression(file, options);
    } catch (error) {
        console.error("Image compression failed:", error);
        return file; // Fallback to original
    }
}

/**
 * Transcode / Compress a video file using FFmpeg.wasm
 * Target: 720p or lower, reduced bitrate
 */
export async function compressVideo(file: File, onProgress?: (p: number) => void): Promise<File> {
    try {
        const instance = await withTimeout(
            loadFFmpeg(),
            FFMPEG_CORE_LOAD_TIMEOUT_MS,
            "FFmpeg preparation"
        );

        const inputName = "input_" + file.name;
        const outputName = "output.mp4";

        instance.on("log", ({ message }) => {
            console.debug("[FFmpeg]", message);
        });

        instance.on("progress", ({ progress }) => {
            if (onProgress) onProgress(Math.round(progress * 100));
        });

        const fileBytes = await withTimeout(
            fetchFile(file),
            FFMPEG_CORE_LOAD_TIMEOUT_MS,
            "Video read for FFmpeg"
        );
        await withTimeout(
            instance.writeFile(inputName, fileBytes),
            FFMPEG_CORE_LOAD_TIMEOUT_MS,
            "FFmpeg input write"
        );

        // Command to scale to 720p (if larger) and use a reasonable CRF for size/quality balance
        // -vf "scale='min(1280,iw)':-2" ensures width is at most 1280 and height is proportional and even
        await withTimeout(instance.exec([
            "-i", inputName,
            "-vf", "scale='min(1280,iw)':-2",
            "-vcodec", "libx264",
            "-crf", "28",
            "-preset", "veryfast",
            "-acodec", "aac",
            "-b:a", "128k",
            "-movflags", "faststart",
            outputName
        ]), FFMPEG_TRANSCODE_TIMEOUT_MS, "FFmpeg transcode");

        const data = await withTimeout(
            instance.readFile(outputName),
            FFMPEG_CORE_LOAD_TIMEOUT_MS,
            "FFmpeg output read"
        );
        const buffer = typeof data === "string" ? new TextEncoder().encode(data) : data;
        const compressedBlob = new Blob([buffer as any], { type: "video/mp4" });

        // Cleanup
        await instance.deleteFile(inputName);
        await instance.deleteFile(outputName);

        return new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + ".mp4", {
            type: "video/mp4",
        });
    } catch (error) {
        console.error("Video compression failed:", error);
        return file; // Fallback to original
    }
}

/**
 * Generate a thumbnail for a video file
 */
export async function generateVideoThumbnail(file: File): Promise<string | null> {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;
        let settled = false;

        const finish = (value: string | null): void => {
            if (settled) return;
            settled = true;
            URL.revokeObjectURL(url);
            resolve(value);
        };

        const url = URL.createObjectURL(file);
        video.src = url;
        const timeoutHandle = setTimeout(() => {
            finish(null);
        }, VIDEO_THUMBNAIL_TIMEOUT_MS);

        video.onloadedmetadata = () => {
            // Seek to 1 second or half way if shorter
            video.currentTime = Math.min(1, video.duration / 2);
        };

        video.onseeked = () => {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");

            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const thumbnailUrl = canvas.toDataURL("image/jpeg", 0.7);
                clearTimeout(timeoutHandle);
                finish(thumbnailUrl);
            } else {
                clearTimeout(timeoutHandle);
                finish(null);
            }
        };

        video.onerror = () => {
            clearTimeout(timeoutHandle);
            finish(null);
        };
    });
}

/**
 * Determine if a file should be compressed based on its size and type
 */
export function shouldCompress(file: File): boolean {
    if (file.type.startsWith("image/")) {
        return file.size > 1 * 1024 * 1024; // > 1MB
    }
    if (file.type.startsWith("video/")) {
        return file.size > 5 * 1024 * 1024; // > 5MB
    }
    return false;
}
