import { beforeEach, describe, expect, it, vi } from "vitest";
import { getVoiceNoteRecordingCapability } from "./voice-note-recording-capability";

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

const defineMediaRecorder = (options: Readonly<{
  installed: boolean;
  supportedMimeTypes?: ReadonlyArray<string>;
}>): void => {
  if (!options.installed) {
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: undefined,
    });
    return;
  }
  class FakeMediaRecorder {
    static isTypeSupported = (mimeType: string): boolean => (
      (options.supportedMimeTypes ?? []).includes(mimeType)
    );
  }
  Object.defineProperty(window, "MediaRecorder", {
    configurable: true,
    value: FakeMediaRecorder,
  });
};

describe("voice-note-recording-capability", () => {
  beforeEach(() => {
    defineSecureContext(true);
    defineMediaDevices(true);
    defineMediaRecorder({
      installed: true,
      supportedMimeTypes: ["audio/webm;codecs=opus", "audio/webm"],
    });
  });

  it("returns insecure_context when runtime is not secure", () => {
    defineSecureContext(false);

    const capability = getVoiceNoteRecordingCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: false,
      reasonCode: "insecure_context",
      isSecureContext: false,
    }));
  });

  it("returns media_devices_unavailable when getUserMedia is missing", () => {
    defineMediaDevices(false);

    const capability = getVoiceNoteRecordingCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: false,
      reasonCode: "media_devices_unavailable",
      hasMediaDevices: false,
    }));
  });

  it("returns media_recorder_unavailable when MediaRecorder constructor is missing", () => {
    defineMediaRecorder({ installed: false });

    const capability = getVoiceNoteRecordingCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: false,
      reasonCode: "media_recorder_unavailable",
      hasMediaRecorder: false,
    }));
  });

  it("returns no_supported_audio_mime when MediaRecorder exposes no supported audio mime", () => {
    defineMediaRecorder({ installed: true, supportedMimeTypes: [] });

    const capability = getVoiceNoteRecordingCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: false,
      reasonCode: "no_supported_audio_mime",
      supportedMimeTypeCount: 0,
    }));
  });

  it("returns supported capability with preferred mime type when runtime supports voice notes", () => {
    defineMediaRecorder({
      installed: true,
      supportedMimeTypes: ["audio/webm", "audio/ogg"],
    });

    const capability = getVoiceNoteRecordingCapability();

    expect(capability).toEqual(expect.objectContaining({
      supported: true,
      reasonCode: "supported",
      preferredMimeType: "audio/webm",
      supportedMimeTypeCount: 2,
      hasMediaDevices: true,
      hasMediaRecorder: true,
      isSecureContext: true,
    }));
  });
});
