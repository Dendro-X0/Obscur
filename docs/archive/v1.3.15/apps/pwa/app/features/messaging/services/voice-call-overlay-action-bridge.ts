export const VOICE_CALL_OVERLAY_ACTION_EVENT_NAME = "obscur:voice-call-overlay-action";
export const VOICE_CALL_OVERLAY_ACTION_STORAGE_KEY = "obscur.voice_call.overlay_action.v1";
export const VOICE_CALL_OVERLAY_ACTION_MAX_AGE_MS = 20_000;

export type VoiceCallOverlayAction = "open_chat" | "accept" | "decline" | "end" | "dismiss";

const VOICE_CALL_OVERLAY_ACTION_SET: ReadonlySet<VoiceCallOverlayAction> = new Set([
  "open_chat",
  "accept",
  "decline",
  "end",
  "dismiss",
]);

const isVoiceCallOverlayAction = (value: unknown): value is VoiceCallOverlayAction => (
  typeof value === "string"
  && VOICE_CALL_OVERLAY_ACTION_SET.has(value as VoiceCallOverlayAction)
);

export const extractVoiceCallOverlayAction = (payload: unknown): VoiceCallOverlayAction | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const action = (payload as { action?: unknown }).action;
  if (!isVoiceCallOverlayAction(action)) {
    return null;
  }
  return action;
};

export const dispatchVoiceCallOverlayAction = (action: VoiceCallOverlayAction): void => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.sessionStorage.setItem(
      VOICE_CALL_OVERLAY_ACTION_STORAGE_KEY,
      JSON.stringify({
        action,
        atUnixMs: Date.now(),
      }),
    );
  } catch {
    // best effort bridge only
  }
  window.dispatchEvent(new CustomEvent(VOICE_CALL_OVERLAY_ACTION_EVENT_NAME, {
    detail: { action },
  }));
};

export const readAndConsumePendingVoiceCallOverlayAction = (): VoiceCallOverlayAction | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(VOICE_CALL_OVERLAY_ACTION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    window.sessionStorage.removeItem(VOICE_CALL_OVERLAY_ACTION_STORAGE_KEY);
    const parsed = JSON.parse(raw) as Partial<{ action: unknown; atUnixMs: unknown }>;
    const action = isVoiceCallOverlayAction(parsed.action) ? parsed.action : null;
    if (!action) {
      return null;
    }
    if (typeof parsed.atUnixMs === "number" && Number.isFinite(parsed.atUnixMs)) {
      const ageMs = Math.max(0, Date.now() - parsed.atUnixMs);
      if (ageMs > VOICE_CALL_OVERLAY_ACTION_MAX_AGE_MS) {
        return null;
      }
    }
    return action;
  } catch {
    return null;
  }
};
