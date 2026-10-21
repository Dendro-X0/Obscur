export type RealtimeVoiceUnsupportedReasonCode =
  | "insecure_context"
  | "media_devices_unavailable"
  | "webrtc_unavailable"
  | "webrtc_add_track_unavailable";

export type RealtimeVoiceCapability = Readonly<{
  supported: boolean;
  reasonCode: RealtimeVoiceUnsupportedReasonCode | "supported";
  isSecureContext: boolean;
  hasMediaDevices: boolean;
  hasPeerConnection: boolean;
  hasAddTrack: boolean;
  opusCapabilityStatus: "available" | "missing" | "unknown";
  /** M1-A: WebRTC can carry a video track (codecs/runtime) — not “camera plugged in”. */
  videoCapabilityStatus: "available" | "missing" | "unknown";
  supportsVideo: boolean;
}>;

const isSecureContextSafe = (): boolean => (
  typeof window === "undefined" ? false : window.isSecureContext !== false
);

const hasMediaDevicesSafe = (): boolean => {
  if (typeof navigator === "undefined") {
    return false;
  }
  return typeof navigator.mediaDevices?.getUserMedia === "function";
};

const getPeerConnectionConstructor = (): (typeof RTCPeerConnection) | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const candidate = (
    window as Window & { RTCPeerConnection?: typeof RTCPeerConnection }
  ).RTCPeerConnection;
  return typeof candidate === "function" ? candidate : null;
};

const hasAddTrackSupport = (
  peerConnectionCtor: typeof RTCPeerConnection | null,
): boolean => {
  if (!peerConnectionCtor) {
    return false;
  }
  return typeof peerConnectionCtor.prototype?.addTrack === "function";
};

const getRtpSenderCapabilities = (
  kind: "audio" | "video",
): ReadonlyArray<{ mimeType?: string }> | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const senderCtor = (
    window as Window & { RTCRtpSender?: typeof RTCRtpSender }
  ).RTCRtpSender;
  if (!senderCtor || typeof senderCtor.getCapabilities !== "function") {
    return null;
  }
  const capabilities = senderCtor.getCapabilities(kind);
  const codecs = Array.isArray(capabilities?.codecs) ? capabilities.codecs : [];
  return codecs;
};

const getOpusCapabilityStatus = (): "available" | "missing" | "unknown" => {
  const codecs = getRtpSenderCapabilities("audio");
  if (codecs === null) {
    return "unknown";
  }
  if (codecs.length === 0) {
    return "unknown";
  }
  const hasOpus = codecs.some((codec) => (
    typeof codec.mimeType === "string" && codec.mimeType.toLowerCase().includes("opus")
  ));
  return hasOpus ? "available" : "missing";
};

/** Structural video path (VP8/H264/etc.) — independent of a physical camera. */
const getVideoCapabilityStatus = (): "available" | "missing" | "unknown" => {
  const codecs = getRtpSenderCapabilities("video");
  if (codecs === null) {
    return "unknown";
  }
  if (codecs.length === 0) {
    return "unknown";
  }
  const hasVideoCodec = codecs.some((codec) => (
    typeof codec.mimeType === "string" && codec.mimeType.toLowerCase().startsWith("video/")
  ));
  return hasVideoCodec ? "available" : "missing";
};

export const getRealtimeVoiceCapability = (): RealtimeVoiceCapability => {
  const secureContext = isSecureContextSafe();
  const hasMediaDevices = hasMediaDevicesSafe();
  const peerConnectionCtor = getPeerConnectionConstructor();
  const hasPeerConnection = peerConnectionCtor !== null;
  const hasAddTrack = hasAddTrackSupport(peerConnectionCtor);
  const opusCapabilityStatus = getOpusCapabilityStatus();
  const videoCapabilityStatus = getVideoCapabilityStatus();
  const supportsVideoBase = hasAddTrack && videoCapabilityStatus !== "missing";

  if (!secureContext) {
    return {
      supported: false,
      reasonCode: "insecure_context",
      isSecureContext: false,
      hasMediaDevices,
      hasPeerConnection,
      hasAddTrack,
      opusCapabilityStatus,
      videoCapabilityStatus,
      supportsVideo: false,
    };
  }

  if (!hasMediaDevices) {
    return {
      supported: false,
      reasonCode: "media_devices_unavailable",
      isSecureContext: true,
      hasMediaDevices: false,
      hasPeerConnection,
      hasAddTrack,
      opusCapabilityStatus,
      videoCapabilityStatus,
      supportsVideo: false,
    };
  }

  if (!hasPeerConnection) {
    return {
      supported: false,
      reasonCode: "webrtc_unavailable",
      isSecureContext: true,
      hasMediaDevices: true,
      hasPeerConnection: false,
      hasAddTrack: false,
      opusCapabilityStatus,
      videoCapabilityStatus,
      supportsVideo: false,
    };
  }

  if (!hasAddTrack) {
    return {
      supported: false,
      reasonCode: "webrtc_add_track_unavailable",
      isSecureContext: true,
      hasMediaDevices: true,
      hasPeerConnection: true,
      hasAddTrack: false,
      opusCapabilityStatus,
      videoCapabilityStatus,
      supportsVideo: false,
    };
  }

  return {
    supported: true,
    reasonCode: "supported",
    isSecureContext: true,
    hasMediaDevices: true,
    hasPeerConnection: true,
    hasAddTrack: true,
    opusCapabilityStatus,
    videoCapabilityStatus,
    supportsVideo: supportsVideoBase,
  };
};

export const realtimeVoiceCapabilityInternals = {
  getPeerConnectionConstructor,
  hasAddTrackSupport,
  hasMediaDevicesSafe,
  isSecureContextSafe,
  getOpusCapabilityStatus,
  getVideoCapabilityStatus,
};
