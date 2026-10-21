/**
 * Call chrome: dock · mobile fullscreen · desktop stage.
 * Outgoing ring must not look like an established AV call (peer may never accept).
 */

import type { SupportedCallType } from "./voice-call-reason-honesty";
import { shouldShowVideoCallPanes } from "./voice-call-reason-honesty";

export type VoiceCallPresentation = "dock" | "fullscreen" | "stage";

export type VoiceCallPresentationPhase =
  | "ringing_outgoing"
  | "ringing_incoming"
  | "connecting"
  | "connected"
  | "interrupted"
  | "ended";

/** Full AV stage only after peer has engaged (connecting/connected). */
export const isVoiceCallAvStagePhase = (
  phase: VoiceCallPresentationPhase | null | undefined,
): boolean => phase === "connecting" || phase === "connected";

export const resolveVoiceCallPresentation = (params: Readonly<{
  isMobileShell: boolean;
  callType: SupportedCallType | undefined;
  phase?: VoiceCallPresentationPhase | null;
}>): VoiceCallPresentation => {
  if (!shouldShowVideoCallPanes(params.callType)) {
    return "dock";
  }
  if (!isVoiceCallAvStagePhase(params.phase)) {
    return "dock";
  }
  return params.isMobileShell ? "fullscreen" : "stage";
};
