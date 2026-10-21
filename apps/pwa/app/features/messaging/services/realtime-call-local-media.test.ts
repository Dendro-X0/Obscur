import { describe, expect, it, vi } from "vitest";
import type { MediaStreamRequestResult } from "./media-device-access";
import {
  acquireLocalCallMedia,
  attachLocalMediaToPeerConnection,
  CAMERA_UNAVAILABLE_BANNER_DEFAULT,
  isLabCanvasVideoEnabled,
  LAB_CANVAS_VIDEO_BANNER_DEFAULT,
  resolveOfferToReceiveVideo,
  shouldShowCameraUnavailableBanner,
  shouldShowLabCanvasVideoBanner,
} from "./realtime-call-local-media";

type FakeTrack = {
  kind: "audio" | "video";
  readyState: "live" | "ended";
  stop: () => void;
};

const createFakeStream = (tracks: ReadonlyArray<FakeTrack>): MediaStream => {
  const list = [...tracks];
  return {
    getTracks: () => list as unknown as MediaStreamTrack[],
    getAudioTracks: () => list.filter((t) => t.kind === "audio") as unknown as MediaStreamTrack[],
    getVideoTracks: () => list.filter((t) => t.kind === "video") as unknown as MediaStreamTrack[],
    addTrack: (track: MediaStreamTrack) => {
      list.push(track as unknown as FakeTrack);
    },
  } as unknown as MediaStream;
};

const audioTrack = (): FakeTrack => ({
  kind: "audio",
  readyState: "live",
  stop: vi.fn(),
});

const videoTrack = (): FakeTrack => ({
  kind: "video",
  readyState: "live",
  stop: vi.fn(),
});

describe("realtime-call-local-media M1-B", () => {
  it("acquires audio-only when video not wanted", async () => {
    const micStream = createFakeStream([audioTrack()]);
    const requestStream = vi.fn(async (params: { kind: string }): Promise<MediaStreamRequestResult> => {
      expect(params.kind).toBe("microphone");
      return { ok: true, stream: micStream };
    });

    const result = await acquireLocalCallMedia({
      wantVideo: false,
      requestStream,
    });

    expect(result).toEqual({
      ok: true,
      stream: micStream,
      mediaMode: "audio",
    });
    expect(requestStream).toHaveBeenCalledTimes(1);
  });

  it("merges av when camera succeeds", async () => {
    const micStream = createFakeStream([audioTrack()]);
    const camStream = createFakeStream([videoTrack()]);
    const merged = createFakeStream([]);
    const requestStream = vi.fn(async (params: { kind: string }): Promise<MediaStreamRequestResult> => {
      if (params.kind === "microphone") {
        return { ok: true, stream: micStream };
      }
      return { ok: true, stream: camStream };
    });

    const result = await acquireLocalCallMedia({
      wantVideo: true,
      requestStream,
      mergeAvStreams: () => merged,
    });

    expect(result).toEqual({
      ok: true,
      stream: merged,
      mediaMode: "av",
    });
    expect(requestStream).toHaveBeenCalledTimes(2);
  });

  it("M1-C: stays off in production even when the env flag is set", () => {
    expect(isLabCanvasVideoEnabled({
      nodeEnv: "production",
      envFlag: "1",
      storageFlag: "1",
    })).toBe(false);
    expect(isLabCanvasVideoEnabled({
      nodeEnv: "development",
      envFlag: "",
      storageFlag: null,
    })).toBe(false);
    expect(isLabCanvasVideoEnabled({
      nodeEnv: "development",
      envFlag: "true",
      storageFlag: null,
    })).toBe(true);
  });

  it("M1-C: uses injected canvas stream only when the lab flag is on", async () => {
    const micStream = createFakeStream([audioTrack()]);
    const canvasStream = createFakeStream([videoTrack()]);
    const merged = createFakeStream([]);
    const requestStream = vi.fn(async (params: { kind: string }): Promise<MediaStreamRequestResult> => {
      if (params.kind === "microphone") {
        return { ok: true, stream: micStream };
      }
      return { ok: false, reasonCode: "not_found", errorName: "NotFoundError" };
    });
    const createLabCanvasStream = vi.fn(() => canvasStream);

    const disabled = await acquireLocalCallMedia({
      wantVideo: true,
      requestStream,
      labCanvasVideoEnabled: false,
      createLabCanvasStream,
    });
    expect(disabled).toMatchObject({ mediaMode: "audio_only_fallback" });
    expect(createLabCanvasStream).not.toHaveBeenCalled();

    const enabled = await acquireLocalCallMedia({
      wantVideo: true,
      requestStream,
      labCanvasVideoEnabled: true,
      createLabCanvasStream,
      mergeAvStreams: () => merged,
    });
    expect(enabled).toEqual({
      ok: true,
      stream: merged,
      mediaMode: "av_lab_canvas",
      cameraReasonCode: "not_found",
    });
  });

  it("falls back to audio_only when camera getUserMedia fails", async () => {
    const micStream = createFakeStream([audioTrack()]);
    const requestStream = vi.fn(async (params: { kind: string }): Promise<MediaStreamRequestResult> => {
      if (params.kind === "microphone") {
        return { ok: true, stream: micStream };
      }
      return { ok: false, reasonCode: "not_found", errorName: "NotFoundError" };
    });

    const result = await acquireLocalCallMedia({
      wantVideo: true,
      requestStream,
    });

    expect(result).toEqual({
      ok: true,
      stream: micStream,
      mediaMode: "audio_only_fallback",
      cameraReasonCode: "not_found",
    });
  });

  it("fails closed when microphone is unavailable", async () => {
    const requestStream = vi.fn(async (): Promise<MediaStreamRequestResult> => ({
      ok: false,
      reasonCode: "permission_denied",
      errorName: "NotAllowedError",
    }));

    const result = await acquireLocalCallMedia({
      wantVideo: true,
      requestStream,
    });

    expect(result).toEqual({
      ok: false,
      reasonCode: "permission_denied",
    });
  });

  it("adds recvonly video transceiver when negotiated video lacks local track", () => {
    const stream = createFakeStream([audioTrack()]);
    const addTrack = vi.fn();
    const addTransceiver = vi.fn();

    const result = attachLocalMediaToPeerConnection({
      connection: { addTrack, addTransceiver } as unknown as RTCPeerConnection,
      stream,
      wantVideoReceive: true,
    });

    expect(addTrack).toHaveBeenCalledTimes(1);
    expect(addTransceiver).toHaveBeenCalledWith("video", { direction: "recvonly" });
    expect(result).toEqual({
      addedAudio: 1,
      addedVideo: 0,
      addedRecvOnlyVideo: true,
    });
  });

  it("does not add recvonly transceiver when local video track present", () => {
    const stream = createFakeStream([audioTrack(), videoTrack()]);
    const addTrack = vi.fn();
    const addTransceiver = vi.fn();

    const result = attachLocalMediaToPeerConnection({
      connection: { addTrack, addTransceiver } as unknown as RTCPeerConnection,
      stream,
      wantVideoReceive: true,
    });

    expect(addTrack).toHaveBeenCalledTimes(2);
    expect(addTransceiver).not.toHaveBeenCalled();
    expect(result).toEqual({
      addedAudio: 1,
      addedVideo: 1,
      addedRecvOnlyVideo: false,
    });
  });

  it("shows honesty banner only for video + audio_only_fallback", () => {
    expect(shouldShowCameraUnavailableBanner({
      callType: "video",
      mediaMode: "audio_only_fallback",
    })).toBe(true);
    expect(shouldShowCameraUnavailableBanner({
      callType: "video",
      mediaMode: "av",
    })).toBe(false);
    expect(shouldShowCameraUnavailableBanner({
      callType: "voice",
      mediaMode: "audio_only_fallback",
    })).toBe(false);
    expect(CAMERA_UNAVAILABLE_BANNER_DEFAULT).toContain("Camera unavailable");
    expect(shouldShowLabCanvasVideoBanner({ mediaMode: "av_lab_canvas" })).toBe(true);
    expect(shouldShowLabCanvasVideoBanner({ mediaMode: "av" })).toBe(false);
    expect(shouldShowCameraUnavailableBanner({
      callType: "video",
      mediaMode: "av_lab_canvas",
    })).toBe(false);
    expect(LAB_CANVAS_VIDEO_BANNER_DEFAULT).toContain("not a camera");
  });

  it("requests offerToReceiveVideo only when video negotiated", () => {
    expect(resolveOfferToReceiveVideo(true)).toBe(true);
    expect(resolveOfferToReceiveVideo(false)).toBe(false);
  });
});
