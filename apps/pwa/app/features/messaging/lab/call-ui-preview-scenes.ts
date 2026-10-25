/**
 * Fixture scenes for inspecting real voice/video chrome without peers, restore, or dial.
 * @see docs/assets/demo/mobile-call-ui-smoke-2026-10.md
 */

import type { VoiceCallDockStatus } from "../components/voice-call-dock";
import type { VoiceCallPresentation } from "../services/realtime-call-presentation";

export type CallUiPreviewSceneId =
  | "voice_outgoing"
  | "voice_incoming"
  | "voice_connecting"
  | "voice_connected"
  | "video_outgoing"
  | "video_connected_fullscreen"
  | "video_connected_stage"
  | "video_camera_unavailable"
  | "interrupted"
  | "ended";

export type CallUiPreviewScene = Readonly<{
  id: CallUiPreviewSceneId;
  label: string;
  /** Incoming uses toast; all others use VoiceCallDock. */
  kind: "toast" | "dock";
  status: VoiceCallDockStatus;
  peerDisplayName: string;
  presentation: VoiceCallPresentation;
  audioLevel?: number;
}>;

const PREVIEW_PEER = "Tester2";
const PREVIEW_ROOM = "lab-call-preview-room-01";
const PREVIEW_PUBKEY = "a".repeat(64);

const baseStatus = (
  patch: Omit<VoiceCallDockStatus, "roomId" | "peerPubkey" | "sinceUnixMs" | "role">
  & Partial<Pick<VoiceCallDockStatus, "role" | "sinceUnixMs">>,
): VoiceCallDockStatus => ({
  roomId: PREVIEW_ROOM,
  peerPubkey: PREVIEW_PUBKEY,
  role: patch.role ?? "host",
  sinceUnixMs: patch.sinceUnixMs ?? Date.now() - 12_000,
  phase: patch.phase,
  callType: patch.callType,
  mediaMode: patch.mediaMode,
  reasonCode: patch.reasonCode,
});

export const CALL_UI_PREVIEW_SCENES: ReadonlyArray<CallUiPreviewScene> = [
  {
    id: "voice_outgoing",
    label: "Voice · outgoing ring (dock)",
    kind: "dock",
    peerDisplayName: PREVIEW_PEER,
    presentation: "dock",
    status: baseStatus({ phase: "ringing_outgoing", callType: "voice" }),
  },
  {
    id: "voice_incoming",
    label: "Voice · incoming toast",
    kind: "toast",
    peerDisplayName: PREVIEW_PEER,
    presentation: "dock",
    status: baseStatus({ phase: "ringing_incoming", role: "joiner", callType: "voice" }),
  },
  {
    id: "voice_connecting",
    label: "Voice · connecting (dock)",
    kind: "dock",
    peerDisplayName: PREVIEW_PEER,
    presentation: "dock",
    status: baseStatus({ phase: "connecting", callType: "voice" }),
  },
  {
    id: "voice_connected",
    label: "Voice · connected + level bars",
    kind: "dock",
    peerDisplayName: PREVIEW_PEER,
    presentation: "dock",
    audioLevel: 0.72,
    status: baseStatus({ phase: "connected", callType: "voice" }),
  },
  {
    id: "video_outgoing",
    label: "Video · outgoing still dock (no AV yet)",
    kind: "dock",
    peerDisplayName: PREVIEW_PEER,
    presentation: "dock",
    status: baseStatus({ phase: "ringing_outgoing", callType: "video" }),
  },
  {
    id: "video_connected_fullscreen",
    label: "Video · mobile fullscreen stage",
    kind: "dock",
    peerDisplayName: PREVIEW_PEER,
    presentation: "fullscreen",
    status: baseStatus({
      phase: "connected",
      callType: "video",
      mediaMode: "av",
    }),
  },
  {
    id: "video_connected_stage",
    label: "Video · desktop floating stage",
    kind: "dock",
    peerDisplayName: PREVIEW_PEER,
    presentation: "stage",
    status: baseStatus({
      phase: "connected",
      callType: "video",
      mediaMode: "av",
    }),
  },
  {
    id: "video_camera_unavailable",
    label: "Video · camera unavailable banner",
    kind: "dock",
    peerDisplayName: PREVIEW_PEER,
    presentation: "fullscreen",
    status: baseStatus({
      phase: "connected",
      callType: "video",
      mediaMode: "audio_only_fallback",
    }),
  },
  {
    id: "interrupted",
    label: "Call interrupted honesty",
    kind: "dock",
    peerDisplayName: PREVIEW_PEER,
    presentation: "dock",
    status: baseStatus({
      phase: "interrupted",
      callType: "voice",
      reasonCode: "network_interrupted",
    }),
  },
  {
    id: "ended",
    label: "Call ended honesty",
    kind: "dock",
    peerDisplayName: PREVIEW_PEER,
    presentation: "dock",
    status: baseStatus({
      phase: "ended",
      callType: "voice",
      reasonCode: "left_by_user",
    }),
  },
];

export const DEFAULT_CALL_UI_PREVIEW_CYCLE_MS = 4500;

export const resolveCallUiPreviewScene = (
  sceneId: string | null | undefined,
): CallUiPreviewScene => {
  const match = CALL_UI_PREVIEW_SCENES.find((scene) => scene.id === sceneId);
  return match ?? CALL_UI_PREVIEW_SCENES[0]!;
};

export const nextCallUiPreviewSceneId = (currentId: CallUiPreviewSceneId): CallUiPreviewSceneId => {
  const index = CALL_UI_PREVIEW_SCENES.findIndex((scene) => scene.id === currentId);
  const next = CALL_UI_PREVIEW_SCENES[(index + 1) % CALL_UI_PREVIEW_SCENES.length];
  return next!.id;
};

export const DEV_UI_LAB_ROUTE_PREFIX = "/lab";

export const isDevUiLabRoute = (pathname: string): boolean => {
  const normalized = pathname.trim() || "/";
  return normalized === DEV_UI_LAB_ROUTE_PREFIX
    || normalized.startsWith(`${DEV_UI_LAB_ROUTE_PREFIX}/`);
};
