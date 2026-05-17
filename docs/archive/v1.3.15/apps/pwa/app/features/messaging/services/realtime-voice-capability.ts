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

const getOpusCapabilityStatus = (): "available" | "missing" | "unknown" => {
  if (typeof window === "undefined") {
    return "unknown";
  }
  const senderCtor = (
    window as Window & { RTCRtpSender?: typeof RTCRtpSender }
  ).RTCRtpSender;
  if (!senderCtor || typeof senderCtor.getCapabilities !== "function") {
    return "unknown";
  }
  const capabilities = senderCtor.getCapabilities("audio");
  const codecs = Array.isArray(capabilities?.codecs) ? capabilities.codecs : [];
  if (codecs.length === 0) {
    return "unknown";
  }
  const hasOpus = codecs.some((codec) => (
    typeof codec.mimeType === "string" && codec.mimeType.toLowerCase().includes("opus")
  ));
  return hasOpus ? "available" : "missing";
};

export const getRealtimeVoiceCapability = (): RealtimeVoiceCapability => {
  const secureContext = isSecureContextSafe();
  const hasMediaDevices = hasMediaDevicesSafe();
  const peerConnectionCtor = getPeerConnectionConstructor();
  const hasPeerConnection = peerConnectionCtor !== null;
  const hasAddTrack = hasAddTrackSupport(peerConnectionCtor);
  const opusCapabilityStatus = getOpusCapabilityStatus();

  if (!secureContext) {
    return {
      supported: false,
      reasonCode: "insecure_context",
      isSecureContext: false,
      hasMediaDevices,
      hasPeerConnection,
      hasAddTrack,
      opusCapabilityStatus,
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
  };
};

export const realtimeVoiceCapabilityInternals = {
  getPeerConnectionConstructor,
  hasAddTrackSupport,
  hasMediaDevicesSafe,
  isSecureContextSafe,
  getOpusCapabilityStatus,
};
