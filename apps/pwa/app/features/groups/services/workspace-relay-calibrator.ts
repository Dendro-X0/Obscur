import { runRelayNipProbe } from "@/app/features/relays/lib/relay-nip-probe.mjs";
import { toScopedRelayUrl } from "./sealed-community-relay-scope";
import {
  expandWorkspaceRelayUrlCandidates,
  normalizeWorkspaceRelayUrl,
  workspaceRelayIdentityKey,
  workspaceRelayUrlsMatch,
} from "./workspace-relay-url";

export type WorkspaceRelayCalibrationResult = Readonly<{
  canonicalUrl: string;
  sourceUrl: string;
  calibrated: boolean;
  connected: boolean;
  probeLatencyMs?: number;
  candidatesTried: ReadonlyArray<string>;
}>;

export type WorkspaceRelayPoolTransport = Readonly<{
  addTransientRelay?: (url: string) => void;
  reconnectRelay?: (url: string) => void;
  waitForScopedConnection?: (relayUrls: ReadonlyArray<string>, timeoutMs: number) => Promise<boolean>;
  getWritableRelaySnapshot?: (
    relayUrls?: ReadonlyArray<string>,
  ) => Readonly<{ writableRelayUrls?: ReadonlyArray<string> }> | null;
}>;

type RelayListItem = Readonly<{
  url: string;
  enabled: boolean;
}>;

type WorkspaceRelayProbeResult = Readonly<{
  ok: boolean;
  latencyMs: number;
}>;

const DEFAULT_PROBE_TIMEOUT_MS = 4000;
const JOIN_PROBE_TIMEOUT_MS = 2000;

const probeWorkspaceRelaySocket = async (
  relayUrl: string,
  timeoutMs: number,
): Promise<WorkspaceRelayProbeResult> => {
  try {
    const results = await runRelayNipProbe({
      relayUrls: [relayUrl],
      timeoutMs,
    });
    const socketResult = results.find((result) => result.check === "relay_socket");
    const ok = socketResult?.status === "ok" || socketResult?.status === "degraded";
    return {
      ok: ok ?? false,
      latencyMs: socketResult?.latencyMs ?? timeoutMs,
    };
  } catch {
    return { ok: false, latencyMs: timeoutMs };
  }
};

const readWritableRelayFromPool = (
  pool: WorkspaceRelayPoolTransport | undefined,
  relayUrl: string,
): string | null => {
  const snapshot = pool?.getWritableRelaySnapshot?.([relayUrl]);
  const writable = snapshot?.writableRelayUrls?.find((candidate) => (
    workspaceRelayUrlsMatch(candidate, relayUrl)
  ));
  return writable ? normalizeWorkspaceRelayUrl(writable) : null;
};

const probeWithPool = async (params: Readonly<{
  relayUrl: string;
  pool: WorkspaceRelayPoolTransport;
  timeoutMs: number;
}>): Promise<WorkspaceRelayProbeResult> => {
  const start = Date.now();
  const existingWritable = readWritableRelayFromPool(params.pool, params.relayUrl);
  if (existingWritable) {
    return { ok: true, latencyMs: Date.now() - start };
  }

  if (typeof params.pool.addTransientRelay === "function") {
    params.pool.addTransientRelay(params.relayUrl);
  }
  if (typeof params.pool.reconnectRelay === "function") {
    params.pool.reconnectRelay(params.relayUrl);
  }

  let connected = false;
  if (typeof params.pool.waitForScopedConnection === "function") {
    connected = await params.pool.waitForScopedConnection([params.relayUrl], params.timeoutMs);
  }

  const writable = readWritableRelayFromPool(params.pool, params.relayUrl);
  const latencyMs = Date.now() - start;
  return {
    ok: connected || Boolean(writable),
    latencyMs,
  };
};

export const dedupeRelayListByWorkspaceIdentity = <T extends RelayListItem>(
  relays: ReadonlyArray<T>,
): ReadonlyArray<T> => {
  const byKey = new Map<string, T>();
  relays.forEach((relay) => {
    const canonical = normalizeWorkspaceRelayUrl(relay.url) || relay.url;
    const key = workspaceRelayIdentityKey(canonical);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...relay, url: canonical });
      return;
    }
    byKey.set(key, {
      ...existing,
      url: canonical,
      enabled: existing.enabled || relay.enabled,
    });
  });
  return Array.from(byKey.values());
};

export const calibrateWorkspaceRelayUrl = async (params: Readonly<{
  rawUrl: string;
  pool?: WorkspaceRelayPoolTransport;
  timeoutMs?: number;
  probe?: (relayUrl: string) => Promise<WorkspaceRelayProbeResult>;
}>): Promise<WorkspaceRelayCalibrationResult> => {
  const timeoutMs = params.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
  const sourceUrl = params.rawUrl.trim();
  const candidates = expandWorkspaceRelayUrlCandidates(sourceUrl);
  const fallbackCanonical = normalizeWorkspaceRelayUrl(sourceUrl);

  if (candidates.length === 0) {
    return {
      canonicalUrl: fallbackCanonical,
      sourceUrl,
      calibrated: false,
      connected: false,
      candidatesTried: [],
    };
  }

  const existingWritable = readWritableRelayFromPool(params.pool, fallbackCanonical);
  if (existingWritable) {
    return {
      canonicalUrl: existingWritable,
      sourceUrl,
      calibrated: !workspaceRelayUrlsMatch(sourceUrl, existingWritable),
      connected: true,
      probeLatencyMs: 0,
      candidatesTried: candidates,
    };
  }

  const probe = params.probe ?? (async (relayUrl: string): Promise<WorkspaceRelayProbeResult> => {
    if (params.pool) {
      const poolResult = await probeWithPool({ relayUrl, pool: params.pool, timeoutMs });
      if (poolResult.ok) {
        return poolResult;
      }
    }
    return probeWorkspaceRelaySocket(relayUrl, timeoutMs);
  });

  const probeCandidate = async (candidate: string): Promise<{ url: string; latencyMs: number } | null> => {
    const { ok, latencyMs } = await probe(candidate);
    if (!ok) {
      return null;
    }
    return {
      url: normalizeWorkspaceRelayUrl(candidate),
      latencyMs,
    };
  };

  let best = await probeCandidate(fallbackCanonical);
  if (!best) {
    const alternateCandidates = candidates.filter((candidate) => (
      !workspaceRelayUrlsMatch(candidate, fallbackCanonical)
    ));
    const alternateResults = await Promise.all(
      alternateCandidates.map((candidate) => probeCandidate(candidate)),
    );
    alternateResults.forEach((result) => {
      if (!result) {
        return;
      }
      if (!best || result.latencyMs < best.latencyMs) {
        best = result;
      }
    });
  }

  const canonicalUrl = best?.url ?? fallbackCanonical;
  if (best && params.pool && typeof params.pool.addTransientRelay === "function") {
    params.pool.addTransientRelay(canonicalUrl);
  }

  return {
    canonicalUrl,
    sourceUrl,
    calibrated: Boolean(best) && !workspaceRelayUrlsMatch(sourceUrl, canonicalUrl),
    connected: Boolean(best),
    probeLatencyMs: best?.latencyMs,
    candidatesTried: candidates,
  };
};

export const ensureWorkspaceRelayTransportReady = async (params: Readonly<{
  rawUrl: string;
  pool?: WorkspaceRelayPoolTransport;
  timeoutMs?: number;
}>): Promise<WorkspaceRelayCalibrationResult> => (
  calibrateWorkspaceRelayUrl(params)
);

export const prepareWorkspaceRelayForJoin = async (params: Readonly<{
  rawUrl: string;
  pool: WorkspaceRelayPoolTransport;
  addRelay: (relayParams: Readonly<{ url: string }>) => void;
  timeoutMs?: number;
}>): Promise<string> => {
  const timeoutMs = params.timeoutMs ?? JOIN_PROBE_TIMEOUT_MS;
  const calibration = await ensureWorkspaceRelayTransportReady({
    rawUrl: params.rawUrl,
    pool: params.pool,
    timeoutMs,
  });
  const targetRelay = toScopedRelayUrl(calibration.canonicalUrl) ?? calibration.canonicalUrl;
  if (targetRelay.length > 0) {
    params.addRelay({ url: targetRelay });
    params.pool.addTransientRelay?.(targetRelay);
    if (params.pool.waitForScopedConnection && !calibration.connected) {
      await params.pool.waitForScopedConnection([targetRelay], timeoutMs);
    }
    const candidates = expandWorkspaceRelayUrlCandidates(targetRelay);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const snapshot = params.pool.getWritableRelaySnapshot?.(candidates);
      if ((snapshot?.writableRelayUrls?.length ?? 0) > 0) {
        break;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }
  }
  return targetRelay;
};

export const shouldRetryPublishAfterWorkspaceCalibration = (
  overallError: string | undefined,
): boolean => {
  const normalized = (overallError ?? "").toLowerCase();
  return normalized.includes("no writable")
    || normalized.includes("no_writable")
    || normalized.includes("scoped publish failed")
    || normalized.includes("no_scoped_relay");
};
