/**
 * M1-B: acquire local mic (+ optional camera) and attach tracks / video transceiver.
 * Camera failure → continue audio-only with honest fallback mode.
 * M1-C: optional lab canvas track — never on in production, never a Gift demo.
 */

import {
  requestMediaStream,
  type MediaAccessReasonCode,
  type MediaStreamRequestResult,
} from "./media-device-access";

export type CallLocalMediaMode = "audio" | "av" | "audio_only_fallback" | "av_lab_canvas";

/** Dev-only. Production builds ignore env and storage. */
export const LAB_CANVAS_VIDEO_STORAGE_KEY = "obscur.dev.lab_canvas_video.v1";

const isTruthyLabFlag = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

/**
 * Lab canvas video is off unless a non-production runtime opts in.
 * Production always returns false so a leaked env cannot fake a camera demo.
 */
export const isLabCanvasVideoEnabled = (params?: Readonly<{
  nodeEnv?: string;
  envFlag?: string;
  storageFlag?: string | null;
}>): boolean => {
  const nodeEnv = params?.nodeEnv ?? process.env.NODE_ENV ?? "";
  if (nodeEnv === "production") {
    return false;
  }
  const envFlag = params?.envFlag ?? process.env.NEXT_PUBLIC_OBSCUR_LAB_CANVAS_VIDEO ?? "";
  if (isTruthyLabFlag(envFlag)) {
    return true;
  }
  if (params && "storageFlag" in params) {
    return params.storageFlag === "1";
  }
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(LAB_CANVAS_VIDEO_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

/** Static “LAB” frame. Not a camera and not for Gift GIFs. */
export const createLabCanvasVideoStream = (): MediaStream | null => {
  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 180;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.fillStyle = "#111827";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f59e0b";
  context.font = "24px sans-serif";
  context.fillText("LAB", 24, 100);
  const capture = typeof canvas.captureStream === "function"
    ? canvas.captureStream(2)
    : null;
  const track = capture?.getVideoTracks()[0];
  if (!capture || !track) {
    return null;
  }
  return capture;
};

export type AcquireLocalCallMediaResult =
  | Readonly<{
    ok: true;
    stream: MediaStream;
    mediaMode: CallLocalMediaMode;
    cameraReasonCode?: MediaAccessReasonCode;
  }>
  | Readonly<{
    ok: false;
    reasonCode: MediaAccessReasonCode;
  }>;

export type AttachLocalMediaResult = Readonly<{
  addedAudio: number;
  addedVideo: number;
  addedRecvOnlyVideo: boolean;
}>;

type RequestMediaStreamFn = (params: Readonly<{
  kind: "microphone" | "camera";
  deviceId?: string | null;
}>) => Promise<MediaStreamRequestResult>;

type MergeStreamsFn = (
  audioStream: MediaStream,
  videoStream: MediaStream,
) => MediaStream;

const defaultMergeAvStreams: MergeStreamsFn = (audioStream, videoStream) => {
  const merged = new MediaStream();
  audioStream.getAudioTracks().forEach((track) => merged.addTrack(track));
  videoStream.getVideoTracks().forEach((track) => merged.addTrack(track));
  return merged;
};

/**
 * Mic always required. When wantVideo, try camera; on any camera failure keep mic
 * and mark audio_only_fallback (caller shows honesty banner).
 */
export const acquireLocalCallMedia = async (params: Readonly<{
  wantVideo: boolean;
  requestStream?: RequestMediaStreamFn;
  mergeAvStreams?: MergeStreamsFn;
  /** M1-C. Caller passes isLabCanvasVideoEnabled(); default false. */
  labCanvasVideoEnabled?: boolean;
  createLabCanvasStream?: () => MediaStream | null;
}>): Promise<AcquireLocalCallMediaResult> => {
  const request = params.requestStream ?? requestMediaStream;
  const audio = await request({ kind: "microphone" });
  if (!audio.ok) {
    return { ok: false, reasonCode: audio.reasonCode };
  }

  if (!params.wantVideo) {
    return {
      ok: true,
      stream: audio.stream,
      mediaMode: "audio",
    };
  }

  const video = await request({ kind: "camera" });
  if (!video.ok) {
    if (params.labCanvasVideoEnabled === true) {
      const createCanvas = params.createLabCanvasStream ?? createLabCanvasVideoStream;
      const canvasStream = createCanvas();
      const canvasTrack = canvasStream?.getVideoTracks()[0];
      if (canvasStream && canvasTrack) {
        const merge = params.mergeAvStreams ?? defaultMergeAvStreams;
        return {
          ok: true,
          stream: merge(audio.stream, canvasStream),
          mediaMode: "av_lab_canvas",
          cameraReasonCode: video.reasonCode,
        };
      }
    }
    return {
      ok: true,
      stream: audio.stream,
      mediaMode: "audio_only_fallback",
      cameraReasonCode: video.reasonCode,
    };
  }

  const merge = params.mergeAvStreams ?? defaultMergeAvStreams;
  return {
    ok: true,
    stream: merge(audio.stream, video.stream),
    mediaMode: "av",
  };
};

/**
 * Add local tracks. If video was negotiated but no local video track exists,
 * add a recvonly video transceiver so the peer can still send video.
 */
export const attachLocalMediaToPeerConnection = (params: Readonly<{
  connection: Pick<RTCPeerConnection, "addTrack" | "addTransceiver">;
  stream: MediaStream;
  wantVideoReceive: boolean;
}>): AttachLocalMediaResult => {
  let addedAudio = 0;
  let addedVideo = 0;
  let addedRecvOnlyVideo = false;

  params.stream.getTracks().forEach((track) => {
    try {
      params.connection.addTrack(track, params.stream);
      if (track.kind === "audio") {
        addedAudio += 1;
      }
      if (track.kind === "video") {
        addedVideo += 1;
      }
    } catch {
      // best effort
    }
  });

  if (params.wantVideoReceive && addedVideo === 0) {
    try {
      if (typeof params.connection.addTransceiver === "function") {
        params.connection.addTransceiver("video", { direction: "recvonly" });
        addedRecvOnlyVideo = true;
      }
    } catch {
      // best effort
    }
  }

  return { addedAudio, addedVideo, addedRecvOnlyVideo };
};

export const resolveOfferToReceiveVideo = (
  wantVideo: boolean,
): boolean => wantVideo;

export const shouldShowCameraUnavailableBanner = (params: Readonly<{
  callType?: "voice" | "video";
  mediaMode?: CallLocalMediaMode | null;
}>): boolean => (
  params.callType === "video" && params.mediaMode === "audio_only_fallback"
);

export const shouldShowLabCanvasVideoBanner = (params: Readonly<{
  mediaMode?: CallLocalMediaMode | null;
}>): boolean => params.mediaMode === "av_lab_canvas";

export const LAB_CANVAS_VIDEO_BANNER_I18N_KEY = "messaging.videoCallLabCanvasBanner";
export const LAB_CANVAS_VIDEO_BANNER_DEFAULT =
  "Lab canvas stand-in — not a camera. Not a product demo.";

export const CAMERA_UNAVAILABLE_BANNER_I18N_KEY = "messaging.videoCallCameraUnavailableBanner";
export const CAMERA_UNAVAILABLE_BANNER_DEFAULT =
  "Camera unavailable — continuing with voice";
