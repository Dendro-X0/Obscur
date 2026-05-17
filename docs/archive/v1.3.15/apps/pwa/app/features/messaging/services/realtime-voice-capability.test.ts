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

const defineRtpSenderCapabilities = (
  mimeTypes: ReadonlyArray<string> | null,
): void => {
  if (mimeTypes === null) {
    Object.defineProperty(window, "RTCRtpSender", {
      configurable: true,
      value: undefined,
    });
    return;
  }
  const codecMimeTypes = mimeTypes;
  class FakeRtpSender {
    static getCapabilities = (kind: string): RTCRtpCapabilities | null => {
      if (kind !== "audio") {
        return null;
      }
      return {
        codecs: codecMimeTypes.map((mimeType) => ({
          mimeType,
          clockRate: 48_000,
          channels: 2,
          sdpFmtpLine: "",
        })),
        headerExtensions: [],
      };
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
    defineRtpSenderCapabilities(["audio/opus", "audio/PCMU"]);
  });

  it("returns insecure_context when runtime is not secure", () => {
    defineSecureContext(false);

    const capability = getRealtimeVoiceCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: false,
      reasonCode: "insecure_context",
      isSecureContext: false,
    }));
  });

  it("returns media_devices_unavailable when getUserMedia is missing", () => {
    defineMediaDevices(false);

    const capability = getRealtimeVoiceCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: false,
      reasonCode: "media_devices_unavailable",
      hasMediaDevices: false,
    }));
  });

  it("returns webrtc_unavailable when RTCPeerConnection is missing", () => {
    definePeerConnection({ installed: false });

    const capability = getRealtimeVoiceCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: false,
      reasonCode: "webrtc_unavailable",
      hasPeerConnection: false,
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
    }));
  });

  it("reports missing opus capability when codecs do not include opus", () => {
    defineRtpSenderCapabilities(["audio/PCMU"]);

    const capability = getRealtimeVoiceCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: true,
      reasonCode: "supported",
      opusCapabilityStatus: "missing",
    }));
  });

  it("returns supported capability when runtime has secure WebRTC audio path", () => {
    defineRtpSenderCapabilities(["audio/opus", "audio/PCMU"]);

    const capability = getRealtimeVoiceCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: true,
      reasonCode: "supported",
      isSecureContext: true,
      hasMediaDevices: true,
      hasPeerConnection: true,
      hasAddTrack: true,
      opusCapabilityStatus: "available",
    }));
  });
});
