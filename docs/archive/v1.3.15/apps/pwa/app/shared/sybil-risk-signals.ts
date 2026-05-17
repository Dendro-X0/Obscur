import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { logRuntimeEvent, type RuntimeLogClassification } from "@/app/shared/runtime-log-classification";

export type SybilRiskReason =
  | "request_suppressed"
  | "malformed_event_quarantined"
  | "identity_churn";

export type SybilRiskLevel = "low" | "elevated" | "high";

export type SybilRiskSnapshot = Readonly<{
  score: number;
  level: SybilRiskLevel;
  updatedAtMs: number;
  windowMs: number;
  counts: Readonly<Record<SybilRiskReason, number>>;
  distinctIdentityCount: number;
}>;

type TimedRiskSignal = Readonly<{
  reason: SybilRiskReason;
  atMs: number;
  weight: number;
}>;

type IdentityActivation = Readonly<{
  publicKeyHex: PublicKeyHex;
  atMs: number;
}>;

type SybilRiskState = {
  signals: TimedRiskSignal[];
  identities: IdentityActivation[];
  lastLevel: SybilRiskLevel;
  lastSnapshot: SybilRiskSnapshot;
};

const WINDOW_MS = 10 * 60 * 1000;
const IDENTITY_CHURN_THRESHOLD = 3;
const GLOBAL_STATE_KEY = "__obscur_sybil_risk_signals__";

const DEFAULT_COUNTS: Readonly<Record<SybilRiskReason, number>> = {
  request_suppressed: 0,
  malformed_event_quarantined: 0,
  identity_churn: 0
};

const createSnapshot = (): SybilRiskSnapshot => ({
  score: 0,
  level: "low",
  updatedAtMs: Date.now(),
  windowMs: WINDOW_MS,
  counts: { ...DEFAULT_COUNTS },
  distinctIdentityCount: 0
});

const createState = (): SybilRiskState => ({
  signals: [],
  identities: [],
  lastLevel: "low",
  lastSnapshot: createSnapshot(),
});

const getState = (): SybilRiskState => {
  const root = globalThis as Record<string, unknown>;
  const existing = root[GLOBAL_STATE_KEY];
  if (existing && typeof existing === "object") {
    return existing as SybilRiskState;
  }
  const created = createState();
  root[GLOBAL_STATE_KEY] = created;
  return created;
};

const toLevel = (score: number): SybilRiskLevel => {
  if (score >= 80) return "high";
  if (score >= 35) return "elevated";
  return "low";
};

const classificationForLevel = (level: SybilRiskLevel): RuntimeLogClassification => {
  if (level === "high") return "actionable";
  if (level === "elevated") return "degraded";
  return "expected";
};

const pruneWindow = (state: SybilRiskState, nowMs: number): void => {
  const minTs = nowMs - WINDOW_MS;
  state.signals = state.signals.filter((entry) => entry.atMs >= minTs);
  state.identities = state.identities.filter((entry) => entry.atMs >= minTs);
};

const recomputeSnapshot = (state: SybilRiskState, nowMs: number): SybilRiskSnapshot => {
  pruneWindow(state, nowMs);

  const counts: Record<SybilRiskReason, number> = {
    request_suppressed: 0,
    malformed_event_quarantined: 0,
    identity_churn: 0
  };
  let score = 0;
  state.signals.forEach((entry) => {
    counts[entry.reason] += 1;
    score += entry.weight;
  });
  const distinctIdentityCount = new Set(state.identities.map((entry) => entry.publicKeyHex)).size;
  const level = toLevel(score);
  return {
    score,
    level,
    updatedAtMs: nowMs,
    windowMs: WINDOW_MS,
    counts,
    distinctIdentityCount
  };
};

const applyLevelChangeLog = (state: SybilRiskState, next: SybilRiskSnapshot): void => {
  if (next.level === state.lastLevel) return;
  logRuntimeEvent(
    "sybil_risk.level_change",
    classificationForLevel(next.level),
    [
      "[SybilRisk] Level changed",
      {
        from: state.lastLevel,
        to: next.level,
        score: next.score,
        counts: next.counts,
        distinctIdentityCount: next.distinctIdentityCount,
        windowMs: next.windowMs
      }
    ],
    { windowMs: 30_000, maxPerWindow: 2, summaryEverySuppressed: 10 }
  );
};

const pushSignal = (reason: SybilRiskReason, weight: number, nowMs: number = Date.now()): SybilRiskSnapshot => {
  const state = getState();
  state.signals.push({
    reason,
    weight: Math.max(1, weight),
    atMs: nowMs
  });
  const next = recomputeSnapshot(state, nowMs);
  applyLevelChangeLog(state, next);
  state.lastLevel = next.level;
  state.lastSnapshot = next;
  return next;
};

export const recordRequestSuppressedRisk = (): SybilRiskSnapshot => {
  return pushSignal("request_suppressed", 4);
};

export const recordMalformedEventQuarantinedRisk = (): SybilRiskSnapshot => {
  return pushSignal("malformed_event_quarantined", 6);
};

export const recordIdentityActivationRisk = (publicKeyHex: PublicKeyHex): SybilRiskSnapshot => {
  const state = getState();
  const nowMs = Date.now();
  pruneWindow(state, nowMs);

  const existing = state.identities.find(
    (entry) => entry.publicKeyHex === publicKeyHex && (nowMs - entry.atMs) < 60_000
  );
  if (!existing) {
    state.identities.push({ publicKeyHex, atMs: nowMs });
  }

  const distinctIdentityCount = new Set(state.identities.map((entry) => entry.publicKeyHex)).size;
  if (distinctIdentityCount >= IDENTITY_CHURN_THRESHOLD) {
    return pushSignal("identity_churn", 12, nowMs);
  }
  const next = recomputeSnapshot(state, nowMs);
  state.lastLevel = next.level;
  state.lastSnapshot = next;
  return next;
};

export const getSybilRiskSnapshot = (): SybilRiskSnapshot => {
  const state = getState();
  const next = recomputeSnapshot(state, Date.now());
  state.lastLevel = next.level;
  state.lastSnapshot = next;
  return next;
};

export const resetSybilRiskSignals = (): void => {
  const root = globalThis as Record<string, unknown>;
  root[GLOBAL_STATE_KEY] = createState();
};
