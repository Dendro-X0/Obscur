import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRealtimeVoiceCapability } from "./realtime-voice-capability";

const defineSecureContext = (value: boolean): void => {
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value,
  });
};

const defineMediaDevices = (enabled: boolean): void => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: enabled
      ? { getUserMedia: vi.fn(async () => ({})) }
      : undefined,
  });
};

const definePeerConnection = (options: Readonly<{ installed: boolean; hasAddTrack?: boolean }>): void => {
  if (!options.installed) {
    Object.defineProperty(window, "RTCPeerConnection", {
      configurable: true,
      value: undefined,
    });
    return;
  }
  const hasAddTrack = options.hasAddTrack !== false;
  class FakePeerConnection {
    // Prototype method is attached below when supported.
  }
  if (hasAddTrack) {
    Object.defineProperty(FakePeerConnection.prototype, "addTrack", {
      configurable: true,
      value: vi.fn(),
    });
  } else {
    delete (FakePeerConnection.prototype as { addTrack?: unknown }).addTrack;
  }
  Object.defineProperty(window, "RTCPeerConnection", {
    configurable: true,
    value: FakePeerConnection,
  });
};

const defineRtpSenderCapabilities = (params: Readonly<{
  audio?: ReadonlyArray<string> | null;
  video?: ReadonlyArray<string> | null;
}>): void => {
  if (params.audio === null && params.video === null) {
    Object.defineProperty(window, "RTCRtpSender", {
      configurable: true,
      value: undefined,
    });
    return;
  }
  const audioMimeTypes = params.audio ?? [];
  const videoMimeTypes = params.video ?? [];
  class FakeRtpSender {
    static getCapabilities = (kind: string): RTCRtpCapabilities | null => {
      if (kind === "audio") {
        if (params.audio === null) {
          return null;
        }
        return {
          codecs: audioMimeTypes.map((mimeType) => ({
            mimeType,
            clockRate: 48_000,
            channels: 2,
            sdpFmtpLine: "",
          })),
          headerExtensions: [],
        };
      }
      if (kind === "video") {
        if (params.video === null) {
          return null;
        }
        return {
          codecs: videoMimeTypes.map((mimeType) => ({
            mimeType,
            clockRate: 90_000,
            channels: 1,
            sdpFmtpLine: "",
          })),
          headerExtensions: [],
        };
      }
      return null;
    };
  }
  Object.defineProperty(window, "RTCRtpSender", {
    configurable: true,
    value: FakeRtpSender,
  });
};

describe("realtime-voice-capability", () => {
  beforeEach(() => {
    defineSecureContext(true);
    defineMediaDevices(true);
    definePeerConnection({ installed: true, hasAddTrack: true });
    defineRtpSenderCapabilities({
      audio: ["audio/opus", "audio/PCMU"],
      video: ["video/VP8", "video/H264"],
    });
  });

  it("returns insecure_context when runtime is not secure", () => {
    defineSecureContext(false);

    const capability = getRealtimeVoiceCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: false,
      reasonCode: "insecure_context",
      isSecureContext: false,
      supportsVideo: false,
    }));
  });

  it("returns media_devices_unavailable when getUserMedia is missing", () => {
    defineMediaDevices(false);

    const capability = getRealtimeVoiceCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: false,
      reasonCode: "media_devices_unavailable",
      hasMediaDevices: false,
      supportsVideo: false,
    }));
  });

  it("returns webrtc_unavailable when RTCPeerConnection is missing", () => {
    definePeerConnection({ installed: false });

    const capability = getRealtimeVoiceCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: false,
      reasonCode: "webrtc_unavailable",
      hasPeerConnection: false,
      supportsVideo: false,
    }));
  });

  it("returns webrtc_add_track_unavailable when addTrack is missing", () => {
    definePeerConnection({ installed: true, hasAddTrack: false });

    const capability = getRealtimeVoiceCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: false,
      reasonCode: "webrtc_add_track_unavailable",
      hasPeerConnection: true,
      hasAddTrack: false,
      supportsVideo: false,
    }));
  });

  it("reports missing opus capability when codecs do not include opus", () => {
    defineRtpSenderCapabilities({
      audio: ["audio/PCMU"],
      video: ["video/VP8"],
    });

    const capability = getRealtimeVoiceCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: true,
      reasonCode: "supported",
      opusCapabilityStatus: "missing",
      videoCapabilityStatus: "available",
      supportsVideo: true,
    }));
  });

  it("M1-A: reports supportsVideo when video codecs are available", () => {
    const capability = getRealtimeVoiceCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: true,
      reasonCode: "supported",
      isSecureContext: true,
      hasMediaDevices: true,
      hasPeerConnection: true,
      hasAddTrack: true,
      opusCapabilityStatus: "available",
      videoCapabilityStatus: "available",
      supportsVideo: true,
    }));
  });

  it("M1-A: supportsVideo false when video codecs are explicitly missing", () => {
    defineRtpSenderCapabilities({
      audio: ["audio/opus"],
      video: ["application/octet-stream"],
    });

    const capability = getRealtimeVoiceCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: true,
      videoCapabilityStatus: "missing",
      supportsVideo: false,
    }));
  });
});
