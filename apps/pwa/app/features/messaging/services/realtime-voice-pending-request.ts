export const PENDING_VOICE_CALL_REQUEST_STORAGE_KEY = "obscur-pending-voice-call-request";
export const PENDING_VOICE_CALL_REQUEST_MAX_AGE_MS = 2 * 60 * 1000;

export type PendingVoiceCallRequest = Readonly<{
  peerPubkey: string;
  requestedAtUnixMs: number;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

export const readPendingVoiceCallRequest = (): PendingVoiceCallRequest | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(PENDING_VOICE_CALL_REQUEST_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return null;
    }
    if (typeof parsed.peerPubkey !== "string" || typeof parsed.requestedAtUnixMs !== "number") {
      return null;
    }
    const peerPubkey = parsed.peerPubkey.trim();
    const requestedAtUnixMs = Math.floor(parsed.requestedAtUnixMs);
    if (!peerPubkey || !Number.isFinite(requestedAtUnixMs)) {
      return null;
    }
    return {
      peerPubkey,
      requestedAtUnixMs,
    };
  } catch {
    return null;
  }
};

export const writePendingVoiceCallRequest = (request: PendingVoiceCallRequest): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    PENDING_VOICE_CALL_REQUEST_STORAGE_KEY,
    JSON.stringify(request),
  );
};

export const clearPendingVoiceCallRequest = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(PENDING_VOICE_CALL_REQUEST_STORAGE_KEY);
};

