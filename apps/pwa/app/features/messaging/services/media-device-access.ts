/**
 * Media device detection + permission classification (mic / camera).
 * Spec: specs/backend/media-device-consent-design-2026-08.md
 */

export type MediaConsentKind = "microphone" | "camera";
export type MediaConsentPurpose = "voice_note" | "voice_call" | "qr_scan";
export type MediaPermissionState = "granted" | "denied" | "prompt" | "unknown";
export type MediaAccessReasonCode =
  | "permission_denied"
  | "not_found"
  | "unavailable"
  | "unsupported"
  | "failed";

export type MediaInputDeviceInfo = Readonly<{
  deviceId: string;
  label: string;
  kind: "audioinput" | "videoinput";
}>;

export type MediaStreamRequestResult =
  | Readonly<{ ok: true; stream: MediaStream }>
  | Readonly<{ ok: false; reasonCode: MediaAccessReasonCode; errorName: string | null }>;

const kindToInput = (kind: MediaConsentKind): "audioinput" | "videoinput" =>
  kind === "microphone" ? "audioinput" : "videoinput";

const kindToPermissionName = (kind: MediaConsentKind): PermissionName =>
  (kind === "microphone" ? "microphone" : "camera") as PermissionName;

export const shouldSkipMediaConsentDialog = (
  permission: MediaPermissionState,
  deviceCount: number,
): boolean => permission === "granted" && deviceCount > 0;

/**
 * OS/WebView must own the first microphone grant prompt.
 * In-app dialog is recovery/guidance only (denied) or post-failure explain.
 */
export const shouldRequestMediaPermissionDirectly = (
  permission: MediaPermissionState,
): boolean => (
  permission === "granted"
  || permission === "prompt"
  || permission === "unknown"
);

export const classifyMediaAccessError = (error: unknown): MediaAccessReasonCode => {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "permission_denied";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "not_found";
  }
  if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError") {
    return "unavailable";
  }
  return "failed";
};

export const queryMediaPermission = async (
  kind: MediaConsentKind,
): Promise<MediaPermissionState> => {
  if (typeof navigator === "undefined" || typeof navigator.permissions?.query !== "function") {
    return "unknown";
  }
  try {
    const status = await navigator.permissions.query({ name: kindToPermissionName(kind) });
    if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
      return status.state;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
};

export const listMediaInputDevices = async (
  kind: MediaConsentKind,
): Promise<ReadonlyArray<MediaInputDeviceInfo>> => {
  if (typeof navigator === "undefined" || typeof navigator.mediaDevices?.enumerateDevices !== "function") {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputKind = kindToInput(kind);
    return devices
      .filter((device) => device.kind === inputKind)
      .map((device, index) => ({
        deviceId: device.deviceId || `index-${index}`,
        label: (device.label || "").trim(),
        kind: inputKind,
      }));
  } catch {
    return [];
  }
};

export const buildMediaStreamConstraints = (
  kind: MediaConsentKind,
  deviceId?: string | null,
): MediaStreamConstraints => {
  const trimmedDeviceId = deviceId?.trim() || "";
  if (kind === "microphone") {
    if (!trimmedDeviceId || trimmedDeviceId.startsWith("index-")) {
      return { audio: true };
    }
    return { audio: { deviceId: { exact: trimmedDeviceId } } };
  }
  if (!trimmedDeviceId || trimmedDeviceId.startsWith("index-")) {
    return { video: true };
  }
  return { video: { deviceId: { exact: trimmedDeviceId } } };
};

export const requestMediaStream = async (params: Readonly<{
  kind: MediaConsentKind;
  deviceId?: string | null;
}>): Promise<MediaStreamRequestResult> => {
  if (typeof navigator === "undefined" || typeof navigator.mediaDevices?.getUserMedia !== "function") {
    return { ok: false, reasonCode: "unsupported", errorName: null };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia(
      buildMediaStreamConstraints(params.kind, params.deviceId),
    );
    return { ok: true, stream };
  } catch (error) {
    return {
      ok: false,
      reasonCode: classifyMediaAccessError(error),
      errorName: error instanceof Error ? error.name : null,
    };
  }
};

export const displayLabelForMediaDevice = (
  device: MediaInputDeviceInfo,
  index: number,
  kind: MediaConsentKind,
): string => {
  if (device.label) {
    return device.label;
  }
  return kind === "microphone" ? `Microphone ${index + 1}` : `Camera ${index + 1}`;
};
