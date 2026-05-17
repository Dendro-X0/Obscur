type QuarantineReasonCode =
  | "incoming_connection_request_peer_rate_limited"
  | "incoming_connection_request_peer_cooldown_active"
  | "incoming_connection_request_global_rate_limited"
  | "incoming_connection_request_attack_mode_strict_relay_high_risk"
  | "incoming_connection_request_attack_mode_peer_shared_intel_blocked"
  | "incoming_connection_request_attack_mode_contract_violation";

type QuarantineEvent = Readonly<{
  atUnixMs?: number;
  context?: Readonly<Record<string, unknown>>;
}>;

type AppEventsApi = Readonly<{
  findByName?: (name: string, count?: number) => ReadonlyArray<QuarantineEvent>;
}>;

export type IncomingRequestQuarantineSummary = Readonly<{
  totalSuppressed: number;
  byReason: Readonly<Record<QuarantineReasonCode, number>>;
  byPeerPrefix: Readonly<Record<string, Readonly<{
    count: number;
    latestReasonCode: QuarantineReasonCode;
    lastAtUnixMs: number;
  }>>>;
  recent: ReadonlyArray<Readonly<{
    peerPrefix: string | null;
    reasonCode: QuarantineReasonCode;
    atUnixMs: number;
  }>>;
}>;

const DEFAULT_SUMMARY: IncomingRequestQuarantineSummary = {
  totalSuppressed: 0,
  byReason: {
    incoming_connection_request_peer_rate_limited: 0,
    incoming_connection_request_peer_cooldown_active: 0,
    incoming_connection_request_global_rate_limited: 0,
    incoming_connection_request_attack_mode_strict_relay_high_risk: 0,
    incoming_connection_request_attack_mode_peer_shared_intel_blocked: 0,
    incoming_connection_request_attack_mode_contract_violation: 0,
  },
  byPeerPrefix: {},
  recent: [],
};

const isQuarantineReasonCode = (value: unknown): value is QuarantineReasonCode => (
  value === "incoming_connection_request_peer_rate_limited"
  || value === "incoming_connection_request_peer_cooldown_active"
  || value === "incoming_connection_request_global_rate_limited"
  || value === "incoming_connection_request_attack_mode_strict_relay_high_risk"
  || value === "incoming_connection_request_attack_mode_peer_shared_intel_blocked"
  || value === "incoming_connection_request_attack_mode_contract_violation"
);

const normalizePeerPrefix = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (!/^[0-9a-f]{8,64}$/.test(trimmed)) return null;
  return trimmed.slice(0, 16);
};

const toNumberOrFallback = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
};

export const summarizeIncomingRequestQuarantineEvents = (
  events: ReadonlyArray<QuarantineEvent>,
): IncomingRequestQuarantineSummary => {
  if (!Array.isArray(events) || events.length === 0) {
    return DEFAULT_SUMMARY;
  }

  const byReason: Record<QuarantineReasonCode, number> = {
    incoming_connection_request_peer_rate_limited: 0,
    incoming_connection_request_peer_cooldown_active: 0,
    incoming_connection_request_global_rate_limited: 0,
    incoming_connection_request_attack_mode_strict_relay_high_risk: 0,
    incoming_connection_request_attack_mode_peer_shared_intel_blocked: 0,
    incoming_connection_request_attack_mode_contract_violation: 0,
  };
  const byPeerPrefix: Record<string, {
    count: number;
    latestReasonCode: QuarantineReasonCode;
    lastAtUnixMs: number;
  }> = {};
  const recent: Array<{
    peerPrefix: string | null;
    reasonCode: QuarantineReasonCode;
    atUnixMs: number;
  }> = [];

  let totalSuppressed = 0;
  for (const event of events) {
    const reasonCode = event.context?.reasonCode;
    if (!isQuarantineReasonCode(reasonCode)) {
      continue;
    }
    totalSuppressed += 1;
    byReason[reasonCode] += 1;
    const lastAtUnixMs = toNumberOrFallback(event.atUnixMs, Date.now());
    const peerPrefix = normalizePeerPrefix(event.context?.peerPubkeyPrefix);
    recent.push({
      peerPrefix,
      reasonCode,
      atUnixMs: lastAtUnixMs,
    });

    const normalizedPeerPrefix = peerPrefix;
    if (!normalizedPeerPrefix) {
      continue;
    }
    const existing = byPeerPrefix[normalizedPeerPrefix];
    if (!existing) {
      byPeerPrefix[normalizedPeerPrefix] = {
        count: 1,
        latestReasonCode: reasonCode,
        lastAtUnixMs,
      };
      continue;
    }
    byPeerPrefix[normalizedPeerPrefix] = {
      count: existing.count + 1,
      latestReasonCode: reasonCode,
      lastAtUnixMs: Math.max(existing.lastAtUnixMs, lastAtUnixMs),
    };
  }

  if (totalSuppressed === 0) {
    return DEFAULT_SUMMARY;
  }

  return {
    totalSuppressed,
    byReason,
    byPeerPrefix,
    recent: recent
      .sort((left, right) => right.atUnixMs - left.atUnixMs)
      .slice(0, 8),
  };
};

export const getIncomingRequestQuarantineSummary = (
  params?: Readonly<{ eventWindowSize?: number }>,
): IncomingRequestQuarantineSummary => {
  if (typeof window === "undefined") {
    return DEFAULT_SUMMARY;
  }
  const appEvents = (window as unknown as { obscurAppEvents?: AppEventsApi }).obscurAppEvents;
  if (!appEvents?.findByName) {
    return DEFAULT_SUMMARY;
  }
  const events = appEvents.findByName(
    "messaging.request.incoming_quarantined",
    Math.max(10, params?.eventWindowSize ?? 200),
  );
  return summarizeIncomingRequestQuarantineEvents(events);
};
