export type VoiceNoteRecordingUnsupportedReasonCode =
  | "insecure_context"
  | "media_devices_unavailable"
  | "media_recorder_unavailable"
  | "no_supported_audio_mime";

export type VoiceNoteRecordingCapability = Readonly<{
  supported: boolean;
  reasonCode: VoiceNoteRecordingUnsupportedReasonCode | "supported";
  preferredMimeType: string | null;
  supportedMimeTypeCount: number;
  hasMediaDevices: boolean;
  hasMediaRecorder: boolean;
  isSecureContext: boolean;
}>;

const PREFERRED_AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
] as const;

const isSecureContextSafe = (): boolean => (
  typeof window === "undefined" ? false : window.isSecureContext !== false
);

const hasMediaDevicesSafe = (): boolean => {
  if (typeof navigator === "undefined") {
    return false;
  }
  return typeof navigator.mediaDevices?.getUserMedia === "function";
};

const getMediaRecorderConstructor = (): (typeof MediaRecorder) | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const candidate = (window as Window & { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  return typeof candidate === "function" ? candidate : null;
};

const getSupportedMimeTypes = (
  mediaRecorderCtor: typeof MediaRecorder | null,
): ReadonlyArray<string> => {
  if (!mediaRecorderCtor || typeof mediaRecorderCtor.isTypeSupported !== "function") {
    return [];
  }
  return PREFERRED_AUDIO_MIME_TYPES.filter((mimeType) => mediaRecorderCtor.isTypeSupported(mimeType));
};

export const getVoiceNoteRecordingCapability = (): VoiceNoteRecordingCapability => {
  const secureContext = isSecureContextSafe();
  if (!secureContext) {
    return {
      supported: false,
      reasonCode: "insecure_context",
      preferredMimeType: null,
      supportedMimeTypeCount: 0,
      hasMediaDevices: hasMediaDevicesSafe(),
      hasMediaRecorder: getMediaRecorderConstructor() !== null,
      isSecureContext: false,
    };
  }

  const hasMediaDevices = hasMediaDevicesSafe();
  if (!hasMediaDevices) {
    return {
      supported: false,
      reasonCode: "media_devices_unavailable",
      preferredMimeType: null,
      supportedMimeTypeCount: 0,
      hasMediaDevices: false,
      hasMediaRecorder: getMediaRecorderConstructor() !== null,
      isSecureContext: true,
    };
  }

  const mediaRecorderCtor = getMediaRecorderConstructor();
  if (!mediaRecorderCtor) {
    return {
      supported: false,
      reasonCode: "media_recorder_unavailable",
      preferredMimeType: null,
      supportedMimeTypeCount: 0,
      hasMediaDevices: true,
      hasMediaRecorder: false,
      isSecureContext: true,
    };
  }

  const supportedMimeTypes = getSupportedMimeTypes(mediaRecorderCtor);
  if (
    typeof mediaRecorderCtor.isTypeSupported === "function"
    && supportedMimeTypes.length === 0
  ) {
    return {
      supported: false,
      reasonCode: "no_supported_audio_mime",
      preferredMimeType: null,
      supportedMimeTypeCount: 0,
      hasMediaDevices: true,
      hasMediaRecorder: true,
      isSecureContext: true,
    };
  }

  return {
    supported: true,
    reasonCode: "supported",
    preferredMimeType: supportedMimeTypes[0] ?? null,
    supportedMimeTypeCount: supportedMimeTypes.length,
    hasMediaDevices: true,
    hasMediaRecorder: true,
    isSecureContext: true,
  };
};

export const voiceNoteRecordingCapabilityInternals = {
  getMediaRecorderConstructor,
  getSupportedMimeTypes,
  hasMediaDevicesSafe,
  isSecureContextSafe,
  PREFERRED_AUDIO_MIME_TYPES,
};
