import type { VoiceCallInvitePayload } from "../types";

export type VoiceCallSignalType =
  | "join-request"
  | "offer"
  | "answer"
  | "ice-candidate"
  | "leave";

export type VoiceCallSignalPayload = Readonly<{
  type: "voice-call-signal";
  version: 1;
  roomId: string;
  signalType: VoiceCallSignalType;
  fromPubkey: string;
  toPubkey?: string | null;
  sdp?: Readonly<{
    type: RTCSdpType;
    sdp: string;
  }>;
  candidate?: Readonly<{
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
      usernameFragment?: string | null;
  }>;
  sentAtUnixMs?: number;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isRtcSdpType = (value: unknown): value is RTCSdpType =>
  value === "offer" || value === "answer" || value === "pranswer" || value === "rollback";

const isSignalType = (value: unknown): value is VoiceCallSignalType =>
  value === "join-request"
  || value === "offer"
  || value === "answer"
  || value === "ice-candidate"
  || value === "leave";

const toStringOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const parseSdp = (value: unknown): VoiceCallSignalPayload["sdp"] => {
  if (!isRecord(value) || !isRtcSdpType(value.type) || typeof value.sdp !== "string") {
    return undefined;
  }
  return {
    type: value.type,
    sdp: value.sdp,
  };
};

const parseCandidate = (value: unknown): VoiceCallSignalPayload["candidate"] => {
  if (!isRecord(value) || typeof value.candidate !== "string") {
    return undefined;
  }
  return {
    candidate: value.candidate,
    sdpMid: typeof value.sdpMid === "string" ? value.sdpMid : null,
    sdpMLineIndex: typeof value.sdpMLineIndex === "number" ? value.sdpMLineIndex : null,
    usernameFragment: typeof value.usernameFragment === "string" ? value.usernameFragment : null,
  };
};

const hasUnescapedField = (content: string, field: string): boolean => (
  new RegExp(`"${field}"\\s*:\\s*"[^"]+"`).test(content)
);

const hasEscapedField = (content: string, field: string): boolean => (
  new RegExp(`\\\\"${field}\\\\"\\s*:\\s*\\\\"[^\\\\"]+\\\\"`).test(content)
);

const isLikelyVoiceCallControlText = (content: string): boolean => {
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }
  const hasRoomId = hasUnescapedField(trimmed, "roomId") || hasEscapedField(trimmed, "roomId");
  if (!hasRoomId) {
    return false;
  }
  const isSignal = /"type"\s*:\s*"voice-call-signal"/.test(trimmed)
    || /\\"type\\"\s*:\s*\\"voice-call-signal\\"/.test(trimmed);
  if (isSignal) {
    return /"signalType"\s*:\s*"[^"]+"/.test(trimmed)
      || /\\"signalType\\"\s*:\s*\\"[^\\"]+\\"/.test(trimmed);
  }
  const isInvite = /"type"\s*:\s*"voice-call-invite"/.test(trimmed)
    || /\\"type\\"\s*:\s*\\"voice-call-invite\\"/.test(trimmed);
  return isInvite;
};

const parseJsonRecordPayload = (content: string): Record<string, unknown> | null => {
  let candidate: unknown = content;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      if (!trimmed) {
        return null;
      }
      try {
        candidate = JSON.parse(trimmed);
      } catch {
        return null;
      }
      continue;
    }
    if (isRecord(candidate)) {
      return candidate;
    }
    return null;
  }
  return isRecord(candidate) ? candidate : null;
};

export const parseVoiceCallSignalPayload = (content: string): VoiceCallSignalPayload | null => {
  const parsed = parseJsonRecordPayload(content);
  if (!parsed) {
    return null;
  }
  if (parsed.type !== "voice-call-signal" || parsed.version !== 1) {
    return null;
  }
  if (!isSignalType(parsed.signalType) || typeof parsed.roomId !== "string" || !parsed.roomId.trim()) {
    return null;
  }
  const fromPubkey = toStringOrNull(parsed.fromPubkey);
  if (!fromPubkey) {
    return null;
  }
  const sentAtUnixMs = typeof parsed.sentAtUnixMs === "number" && Number.isFinite(parsed.sentAtUnixMs)
    ? Math.floor(parsed.sentAtUnixMs)
    : undefined;

  return {
    type: "voice-call-signal",
    version: 1,
    roomId: parsed.roomId,
    signalType: parsed.signalType,
    fromPubkey,
    toPubkey: toStringOrNull(parsed.toPubkey),
    sdp: parseSdp(parsed.sdp),
    candidate: parseCandidate(parsed.candidate),
    ...(typeof sentAtUnixMs === "number" ? { sentAtUnixMs } : {}),
  };
};

export const parseVoiceCallInvitePayload = (content: string): VoiceCallInvitePayload | null => {
  const parsed = parseJsonRecordPayload(content);
  if (!parsed || parsed.type !== "voice-call-invite") {
    return null;
  }
  return {
    type: "voice-call-invite",
    version: typeof parsed.version === "number" ? parsed.version : undefined,
    roomId: typeof parsed.roomId === "string" ? parsed.roomId : undefined,
    invitedAtUnixMs: typeof parsed.invitedAtUnixMs === "number" ? parsed.invitedAtUnixMs : undefined,
    expiresAtUnixMs: typeof parsed.expiresAtUnixMs === "number" ? parsed.expiresAtUnixMs : undefined,
    fromPubkey: typeof parsed.fromPubkey === "string" ? parsed.fromPubkey : null,
  };
};

export const createVoiceCallSignalPayload = (params: Readonly<{
  roomId: string;
  signalType: VoiceCallSignalType;
  fromPubkey: string;
  toPubkey?: string | null;
  sdp?: VoiceCallSignalPayload["sdp"];
  candidate?: VoiceCallSignalPayload["candidate"];
  sentAtUnixMs?: number;
}>): VoiceCallSignalPayload => ({
  type: "voice-call-signal",
  version: 1,
  roomId: params.roomId,
  signalType: params.signalType,
  fromPubkey: params.fromPubkey,
  toPubkey: params.toPubkey ?? null,
  sdp: params.sdp,
  candidate: params.candidate,
  sentAtUnixMs: params.sentAtUnixMs ?? Date.now(),
});

export const isVoiceCallControlPayload = (content: string): boolean => (
  parseVoiceCallSignalPayload(content) !== null
  || parseVoiceCallInvitePayload(content) !== null
  || isLikelyVoiceCallControlText(content)
);

export const stripVoiceCallControlPreview = (content: string): string => (
  isVoiceCallControlPayload(content) ? "" : content
);
