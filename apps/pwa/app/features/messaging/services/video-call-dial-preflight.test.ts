import { describe, expect, it, vi } from "vitest";
import { prepareLocalMediaForCallDial } from "./video-call-dial-preflight";

describe("prepareLocalMediaForCallDial", () => {
  it("enumerates devices and acquires AV when camera succeeds", async () => {
    const audioTrack = { kind: "audio", stop: vi.fn() } as unknown as MediaStreamTrack;
    const videoTrack = { kind: "video", stop: vi.fn() } as unknown as MediaStreamTrack;
    const stream = {
      getTracks: () => [audioTrack, videoTrack],
      getAudioTracks: () => [audioTrack],
      getVideoTracks: () => [videoTrack],
    } as unknown as MediaStream;

    const result = await prepareLocalMediaForCallDial({
      wantVideo: true,
      listDevices: async (kind) => (
        kind === "microphone"
          ? [{ deviceId: "mic-1", label: "Mic", kind: "audioinput" }]
          : [{ deviceId: "cam-1", label: "Cam", kind: "videoinput" }]
      ),
      acquire: async () => ({
        ok: true,
        stream,
        mediaMode: "av",
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mediaMode).toBe("av");
    expect(result.microphoneCount).toBe(1);
    expect(result.cameraCount).toBe(1);
    expect(result.stream).toBe(stream);
  });

  it("returns audio_only_fallback when camera fails but mic ok", async () => {
    const audioTrack = { kind: "audio", stop: vi.fn() } as unknown as MediaStreamTrack;
    const stream = {
      getTracks: () => [audioTrack],
      getAudioTracks: () => [audioTrack],
      getVideoTracks: () => [],
    } as unknown as MediaStream;

    const result = await prepareLocalMediaForCallDial({
      wantVideo: true,
      listDevices: async (kind) => (
        kind === "microphone"
          ? [{ deviceId: "mic-1", label: "Mic", kind: "audioinput" }]
          : []
      ),
      acquire: async () => ({
        ok: true,
        stream,
        mediaMode: "audio_only_fallback",
        cameraReasonCode: "not_found",
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mediaMode).toBe("audio_only_fallback");
    expect(result.cameraReasonCode).toBe("not_found");
    expect(result.cameraCount).toBe(0);
  });

  it("marks consent recovery when mic permission denied", async () => {
    const result = await prepareLocalMediaForCallDial({
      wantVideo: true,
      listDevices: async () => [],
      acquire: async () => ({
        ok: false,
        reasonCode: "permission_denied",
      }),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasonCode).toBe("permission_denied");
    expect(result.needsConsentRecovery).toBe(true);
  });

  it("reuses an existing stream without re-acquire", async () => {
    const acquire = vi.fn();
    const stream = { getTracks: () => [] } as unknown as MediaStream;
    const result = await prepareLocalMediaForCallDial({
      wantVideo: true,
      existingStream: stream,
      existingMediaMode: "av",
      listDevices: async () => [],
      acquire,
    });

    expect(acquire).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.stream).toBe(stream);
    expect(result.mediaMode).toBe("av");
  });
});
