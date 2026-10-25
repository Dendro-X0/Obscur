import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceRecorder } from "./voice-recorder";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("@dweb/ui-kit/toast", () => ({
  toast: { error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  getRuntimeCapabilities: () => ({ isNativeRuntime: true }),
}));

vi.mock("@/app/features/messaging/services/voice-note-recording-capability", () => ({
  getVoiceNoteRecordingCapability: () => ({
    supported: true,
    reasonCode: "supported",
    preferredMimeType: "audio/webm",
    supportedMimeTypeCount: 1,
    hasMediaDevices: true,
    hasMediaRecorder: true,
    isSecureContext: true,
  }),
}));

const mediaMocks = vi.hoisted(() => {
  const stopTrack = vi.fn();
  const stream = {
    getTracks: () => [{ stop: stopTrack }],
  } as unknown as MediaStream;
  return {
    stopTrack,
    stream,
    requestMediaStream: vi.fn(async () => ({ ok: true as const, stream })),
  };
});

vi.mock("@/app/features/messaging/services/media-device-access", () => ({
  requestMediaStream: mediaMocks.requestMediaStream,
  shouldOpenMediaConsentRecovery: () => false,
}));

vi.mock("@/app/features/messaging/hooks/use-voice-recording-waveform", () => ({
  useVoiceRecordingWaveform: () => ({
    points: [0.2, 0.4, 0.6],
    intensity: 0.5,
    spectralBlend: 0.3,
    retract: 0,
  }),
}));

vi.mock("./voice-recording-waveform", () => ({
  VoiceRecordingWaveform: () => <div data-testid="voice-waveform" />,
}));

vi.mock("./media-device-consent-dialog", () => ({
  MediaDeviceConsentDialog: () => null,
}));

class FakeMediaRecorder {
  public state = "inactive";
  public mimeType: string;
  public ondataavailable: ((event: { data: Blob }) => void) | null = null;
  public onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, options?: { mimeType?: string }) {
    this.mimeType = options?.mimeType ?? "audio/webm";
  }

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType }) });
    this.onstop?.();
  }
}

describe("VoiceRecorder chrome", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as { MediaRecorder?: typeof FakeMediaRecorder }).MediaRecorder = FakeMediaRecorder;
  });

  it("fills the composer row with cancel, timer track, and send while recording", async () => {
    const onRecordingChange = vi.fn();
    render(
      <VoiceRecorder
        onRecordingComplete={vi.fn()}
        isUploading={false}
        onRecordingChange={onRecordingChange}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("voice-recorder-start"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("voice-recorder")).toHaveAttribute("data-recording", "1");
    });
    expect(onRecordingChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("voice-recorder-cancel")).toBeInTheDocument();
    expect(screen.getByTestId("voice-recorder-send")).toBeInTheDocument();
    expect(screen.getByTestId("voice-waveform")).toBeInTheDocument();
    expect(screen.getByText("0:00")).toBeInTheDocument();
    expect(screen.queryByTestId("voice-recorder-start")).not.toBeInTheDocument();
  });
});
