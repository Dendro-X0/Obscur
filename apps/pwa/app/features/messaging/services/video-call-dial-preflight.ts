/**
 * M1 video dial: enumerate devices + acquire mic/camera before invite send.
 * Camera failure → audio_only_fallback (caller shows honesty); mic failure → abort.
 */

import {
  listMediaInputDevices,
  shouldOpenMediaConsentRecovery,
  type MediaAccessReasonCode,
} from "./media-device-access";
import {
  acquireLocalCallMedia,
  type AcquireLocalCallMediaResult,
  type CallLocalMediaMode,
} from "./realtime-call-local-media";

export type VideoCallDialPreflightResult =
  | Readonly<{
    ok: true;
    stream: MediaStream;
    mediaMode: CallLocalMediaMode;
    cameraReasonCode?: MediaAccessReasonCode;
    microphoneCount: number;
    cameraCount: number;
  }>
  | Readonly<{
    ok: false;
    reasonCode: MediaAccessReasonCode;
    needsConsentRecovery: boolean;
    microphoneCount: number;
    cameraCount: number;
  }>;

type AcquireFn = (params: Readonly<{
  wantVideo: boolean;
  labCanvasVideoEnabled?: boolean;
}>) => Promise<AcquireLocalCallMediaResult>;

type ListDevicesFn = typeof listMediaInputDevices;

/**
 * Check connected mic/camera inputs, then request media (camera when wantVideo).
 * Does not open UI — caller owns consent recovery dialog.
 */
export const prepareLocalMediaForCallDial = async (params: Readonly<{
  wantVideo: boolean;
  labCanvasVideoEnabled?: boolean;
  acquire?: AcquireFn;
  listDevices?: ListDevicesFn;
  /** Reuse an already-held local stream (skip re-acquire). */
  existingStream?: MediaStream | null;
  existingMediaMode?: CallLocalMediaMode | null;
}>): Promise<VideoCallDialPreflightResult> => {
  const list = params.listDevices ?? listMediaInputDevices;
  const [mics, cameras] = await Promise.all([
    list("microphone"),
    list("camera"),
  ]);
  const microphoneCount = mics.length;
  const cameraCount = cameras.length;

  if (params.existingStream) {
    return {
      ok: true,
      stream: params.existingStream,
      mediaMode: params.existingMediaMode ?? (params.wantVideo ? "av" : "audio"),
      microphoneCount,
      cameraCount,
    };
  }

  const acquire = params.acquire ?? acquireLocalCallMedia;
  const result = await acquire({
    wantVideo: params.wantVideo,
    labCanvasVideoEnabled: params.labCanvasVideoEnabled === true,
  });

  if (!result.ok) {
    return {
      ok: false,
      reasonCode: result.reasonCode,
      needsConsentRecovery: shouldOpenMediaConsentRecovery(result.reasonCode),
      microphoneCount,
      cameraCount,
    };
  }

  return {
    ok: true,
    stream: result.stream,
    mediaMode: result.mediaMode,
    cameraReasonCode: result.cameraReasonCode,
    microphoneCount,
    cameraCount,
  };
};
