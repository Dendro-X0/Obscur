/**
 * R1 — parse RTCStatsReport into a deterministic call-quality snapshot.
 * Instrumentation only; does not claim improved media quality.
 */

import { logAppEvent } from "@/app/shared/log-app-event";

export const REALTIME_CALL_QUALITY_SAMPLE_MIN_INTERVAL_MS = 1_000;
export const REALTIME_CALL_QUALITY_WARN_PACKET_LOSS_RATIO = 0.08;
export const REALTIME_CALL_QUALITY_WARN_RTT_MS = 400;

export type RealtimeCallQualitySnapshot = Readonly<{
  sampledAtUnixMs: number;
  connectionState: RTCPeerConnectionState | "unknown";
  iceConnectionState: RTCIceConnectionState | "unknown";
  rttMs: number | null;
  audioPacketLossRatio: number | null;
  audioJitterMs: number | null;
  inboundAudioBytes: number | null;
  inboundVideoBytes: number | null;
  hasInboundVideoEvidence: boolean;
}>;

type StatsRow = Readonly<Record<string, unknown>>;

const toFiniteNumberOrNull = (value: unknown): number | null => (
  typeof value === "number" && Number.isFinite(value) ? value : null
);

const readKind = (row: StatsRow): string | null => {
  if (typeof row.kind === "string" && row.kind.length > 0) {
    return row.kind;
  }
  if (typeof row.mediaType === "string" && row.mediaType.length > 0) {
    return row.mediaType;
  }
  return null;
};

const collectRows = (report: RTCStatsReport | Iterable<unknown>): StatsRow[] => {
  const rows: StatsRow[] = [];
  try {
    for (const entry of report as Iterable<unknown>) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      rows.push(entry as StatsRow);
    }
  }
  catch {
    return [];
  }
  return rows;
};

const selectCandidatePairRttSeconds = (rows: ReadonlyArray<StatsRow>): number | null => {
  const pairs = rows.filter((row) => row.type === "candidate-pair");
  const nominatedSucceeded = pairs.find((row) => (
    row.state === "succeeded" && row.nominated === true
  ));
  const succeeded = nominatedSucceeded
    ?? pairs.find((row) => row.state === "succeeded")
    ?? null;
  if (!succeeded) {
    return null;
  }
  return toFiniteNumberOrNull(succeeded.currentRoundTripTime);
};

const selectInboundRtp = (
  rows: ReadonlyArray<StatsRow>,
  kind: "audio" | "video",
): StatsRow | null => {
  const matches = rows.filter((row) => (
    row.type === "inbound-rtp" && readKind(row) === kind
  ));
  if (matches.length === 0) {
    return null;
  }
  // Prefer the row with the most packets received when multiple SSRCs exist.
  return matches.reduce((best, row) => {
    const bestPackets = toFiniteNumberOrNull(best.packetsReceived) ?? -1;
    const rowPackets = toFiniteNumberOrNull(row.packetsReceived) ?? -1;
    return rowPackets >= bestPackets ? row : best;
  });
};

const resolvePacketLossRatio = (row: StatsRow | null): number | null => {
  if (!row) {
    return null;
  }
  const packetsLost = toFiniteNumberOrNull(row.packetsLost);
  const packetsReceived = toFiniteNumberOrNull(row.packetsReceived);
  if (packetsLost === null && packetsReceived === null) {
    return null;
  }
  const lost = Math.max(0, packetsLost ?? 0);
  const received = Math.max(0, packetsReceived ?? 0);
  const total = lost + received;
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, lost / total));
};

/** W3C jitter is seconds; convert to ms. Values already ≥10 treated as ms. */
const resolveJitterMs = (row: StatsRow | null): number | null => {
  if (!row) {
    return null;
  }
  const jitter = toFiniteNumberOrNull(row.jitter);
  if (jitter === null || jitter < 0) {
    return null;
  }
  if (jitter < 10) {
    return jitter * 1_000;
  }
  return jitter;
};

const resolveBytesReceived = (row: StatsRow | null): number | null => {
  if (!row) {
    return null;
  }
  const bytes = toFiniteNumberOrNull(row.bytesReceived);
  return bytes === null || bytes < 0 ? null : bytes;
};

export const parseRealtimeCallQualitySnapshot = (params: Readonly<{
  report: RTCStatsReport | Iterable<unknown>;
  sampledAtUnixMs: number;
  connectionState?: RTCPeerConnectionState | "unknown";
  iceConnectionState?: RTCIceConnectionState | "unknown";
}>): RealtimeCallQualitySnapshot => {
  const rows = collectRows(params.report);
  const rttSeconds = selectCandidatePairRttSeconds(rows);
  const inboundAudio = selectInboundRtp(rows, "audio");
  const inboundVideo = selectInboundRtp(rows, "video");
  const inboundAudioBytes = resolveBytesReceived(inboundAudio);
  const inboundVideoBytes = resolveBytesReceived(inboundVideo);
  const hasInboundVideoEvidence = inboundVideo !== null
    || (inboundVideoBytes !== null && inboundVideoBytes > 0);

  return {
    sampledAtUnixMs: params.sampledAtUnixMs,
    connectionState: params.connectionState ?? "unknown",
    iceConnectionState: params.iceConnectionState ?? "unknown",
    rttMs: rttSeconds === null ? null : Math.round(rttSeconds * 1_000),
    audioPacketLossRatio: resolvePacketLossRatio(inboundAudio),
    audioJitterMs: resolveJitterMs(inboundAudio),
    inboundAudioBytes,
    inboundVideoBytes,
    hasInboundVideoEvidence,
  };
};

export const shouldEmitRealtimeCallQualitySample = (params: Readonly<{
  phase: string | null | undefined;
  lastEmitUnixMs: number | null;
  nowUnixMs: number;
  minIntervalMs?: number;
}>): boolean => {
  if (params.phase !== "connected") {
    return false;
  }
  if (!Number.isFinite(params.nowUnixMs)) {
    return false;
  }
  const minInterval = params.minIntervalMs ?? REALTIME_CALL_QUALITY_SAMPLE_MIN_INTERVAL_MS;
  if (params.lastEmitUnixMs === null) {
    return true;
  }
  if (!Number.isFinite(params.lastEmitUnixMs)) {
    return true;
  }
  return params.nowUnixMs - params.lastEmitUnixMs >= minInterval;
};

export const resolveRealtimeCallQualitySampleLevel = (
  snapshot: RealtimeCallQualitySnapshot,
): "info" | "warn" => {
  const loss = snapshot.audioPacketLossRatio;
  const rtt = snapshot.rttMs;
  if (
    (typeof loss === "number" && loss >= REALTIME_CALL_QUALITY_WARN_PACKET_LOSS_RATIO)
    || (typeof rtt === "number" && rtt >= REALTIME_CALL_QUALITY_WARN_RTT_MS)
  ) {
    return "warn";
  }
  return "info";
};

export const emitRealtimeCallQualitySample = (params: Readonly<{
  roomIdHint: string | null;
  role: string | null;
  snapshot: RealtimeCallQualitySnapshot;
}>): void => {
  const level = resolveRealtimeCallQualitySampleLevel(params.snapshot);
  const snap = params.snapshot;
  logAppEvent({
    name: "messaging.realtime_voice.quality_sample",
    level,
    scope: { feature: "messaging", action: "realtime_voice_quality" },
    context: {
      roomIdHint: params.roomIdHint,
      role: params.role,
      connectionState: snap.connectionState,
      iceConnectionState: snap.iceConnectionState,
      rttMs: snap.rttMs,
      audioPacketLossRatio: snap.audioPacketLossRatio === null
        ? null
        : Number(snap.audioPacketLossRatio.toFixed(4)),
      audioJitterMs: snap.audioJitterMs === null
        ? null
        : Math.round(snap.audioJitterMs),
      inboundAudioBytes: snap.inboundAudioBytes,
      inboundVideoBytes: snap.inboundVideoBytes,
      hasInboundVideoEvidence: snap.hasInboundVideoEvidence,
    },
  });
};

export const realtimeCallQualityStatsInternals = {
  collectRows,
  resolveJitterMs,
  resolvePacketLossRatio,
  selectCandidatePairRttSeconds,
  selectInboundRtp,
};
