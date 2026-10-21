import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildMediaStreamConstraints,
  classifyMediaAccessError,
  displayLabelForMediaDevice,
  listMediaInputDevices,
  queryMediaPermission,
  requestMediaStream,
  shouldOpenMediaConsentRecovery,
  shouldRequestMediaPermissionDirectly,
  shouldSkipMediaConsentDialog,
  type MediaConsentPurpose,
} from "./media-device-access";

describe("media-device-access", () => {
  it("M1-A: includes video_call among consent purposes", () => {
    const purposes: ReadonlyArray<MediaConsentPurpose> = [
      "voice_note",
      "voice_call",
      "video_call",
      "qr_scan",
    ];
    expect(purposes).toContain("video_call");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips consent dialog only when permission granted and devices exist", () => {
    expect(shouldSkipMediaConsentDialog("granted", 1)).toBe(true);
    expect(shouldSkipMediaConsentDialog("granted", 0)).toBe(false);
    expect(shouldSkipMediaConsentDialog("prompt", 2)).toBe(false);
    expect(shouldSkipMediaConsentDialog("unknown", 2)).toBe(false);
  });

  it("opens in-app recovery only after getUserMedia permission_denied", () => {
    expect(shouldOpenMediaConsentRecovery("permission_denied")).toBe(true);
    expect(shouldOpenMediaConsentRecovery("not_found")).toBe(false);
    expect(shouldOpenMediaConsentRecovery("unavailable")).toBe(false);
    expect(shouldOpenMediaConsentRecovery("failed")).toBe(false);
    expect(shouldOpenMediaConsentRecovery("unsupported")).toBe(false);
  });

  it("keeps legacy shouldRequestMediaPermissionDirectly helper for tests/callers", () => {
    expect(shouldRequestMediaPermissionDirectly("prompt")).toBe(true);
    expect(shouldRequestMediaPermissionDirectly("unknown")).toBe(true);
    expect(shouldRequestMediaPermissionDirectly("granted")).toBe(true);
    expect(shouldRequestMediaPermissionDirectly("denied")).toBe(false);
  });

  it("classifies getUserMedia errors", () => {
    expect(classifyMediaAccessError(Object.assign(new Error("x"), { name: "NotAllowedError" }))).toBe(
      "permission_denied",
    );
    expect(classifyMediaAccessError(Object.assign(new Error("x"), { name: "NotFoundError" }))).toBe(
      "not_found",
    );
    expect(classifyMediaAccessError(Object.assign(new Error("x"), { name: "NotReadableError" }))).toBe(
      "unavailable",
    );
    expect(classifyMediaAccessError(new Error("other"))).toBe("failed");
  });

  it("builds constraints with optional deviceId", () => {
    expect(buildMediaStreamConstraints("microphone")).toEqual({ audio: true });
    expect(buildMediaStreamConstraints("microphone", "dev-1")).toEqual({
      audio: { deviceId: { exact: "dev-1" } },
    });
    expect(buildMediaStreamConstraints("camera", "cam-1")).toEqual({
      video: { deviceId: { exact: "cam-1" } },
    });
  });

  it("lists audioinput devices from enumerateDevices", async () => {
    vi.stubGlobal("navigator", {
      mediaDevices: {
        enumerateDevices: vi.fn(async () => [
          { deviceId: "a", label: "Headset", kind: "audioinput" },
          { deviceId: "b", label: "Webcam", kind: "videoinput" },
        ]),
      },
    });
    await expect(listMediaInputDevices("microphone")).resolves.toEqual([
      { deviceId: "a", label: "Headset", kind: "audioinput" },
    ]);
  });

  it("maps permission query states", async () => {
    vi.stubGlobal("navigator", {
      permissions: {
        query: vi.fn(async () => ({ state: "prompt" })),
      },
    });
    await expect(queryMediaPermission("microphone")).resolves.toBe("prompt");
  });

  it("requests media stream and maps failures", async () => {
    const stream = { id: "s1" } as unknown as MediaStream;
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(async () => stream),
      },
    });
    await expect(requestMediaStream({ kind: "microphone" })).resolves.toEqual({
      ok: true,
      stream,
    });

    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(async () => {
          throw Object.assign(new Error("denied"), { name: "NotAllowedError" });
        }),
      },
    });
    await expect(requestMediaStream({ kind: "microphone" })).resolves.toEqual({
      ok: false,
      reasonCode: "permission_denied",
      errorName: "NotAllowedError",
    });
  });

  it("falls back to numbered labels when device label empty", () => {
    expect(
      displayLabelForMediaDevice({ deviceId: "x", label: "", kind: "audioinput" }, 0, "microphone"),
    ).toBe("Microphone 1");
  });
});
