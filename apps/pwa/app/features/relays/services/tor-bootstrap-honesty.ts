/**
 * Honesty helpers for Tor Warming — never treat percent < 100 as Ready.
 * Stall detection: surface gateway detail instead of endless Warming.
 */

export const formatTorBootstrapProgressSuffix = (
  percent: number | null | undefined,
): string => {
  if (typeof percent !== "number" || !Number.isFinite(percent)) {
    return "";
  }
  if (percent < 0 || percent >= 100) {
    return "";
  }
  return ` ${Math.floor(percent)}%`;
};

/** Soft timeout before treating silent Warming as stalled (no Stuck keyword yet). */
export const TOR_BOOTSTRAP_SOFT_STALL_MS = 20_000;

const STALL_DETAIL_PATTERNS: ReadonlyArray<RegExp> = [
  /\bstuck at\b/i,
  /\bproblem bootstrapping\b/i,
  /\btls_error\b/i,
  /\bunexpected eof\b/i,
  /\brecommendation warn\b/i,
];

export const isTorBootstrapStuckDetail = (
  detail: string | null | undefined,
): boolean => {
  const text = detail?.trim() ?? "";
  if (text.length === 0) {
    return false;
  }
  return STALL_DETAIL_PATTERNS.some((pattern) => pattern.test(text));
};

/**
 * Prefer the newest log/status line that carries Stuck / TIMEOUT / TLS evidence.
 * Used when the status snapshot was cleared by restart/"waiting…" churn.
 */
export const pickTorBootstrapStallDetail = (
  primary?: string | null,
  fallbackLines?: ReadonlyArray<string> | null,
): string | null => {
  const candidates: string[] = [];
  const primaryText = primary?.trim() ?? "";
  if (primaryText.length > 0) {
    candidates.push(primaryText);
  }
  if (fallbackLines) {
    for (let i = fallbackLines.length - 1; i >= 0; i -= 1) {
      const line = fallbackLines[i]?.trim() ?? "";
      if (line.length === 0) {
        continue;
      }
      // Strip R4 log prefixes so pattern matching sees the Tor notice.
      const stripped = line.replace(/^R4:\s*gateway detail:\s*/i, "").trim();
      candidates.push(stripped.length > 0 ? stripped : line);
    }
  }
  const explicit = candidates.find((line) => isTorBootstrapStuckDetail(line));
  if (explicit) {
    return explicit;
  }
  return primaryText.length > 0 ? primaryText : null;
};

/**
 * Extract a short operator-facing stall reason from gateway detail.
 * Falls back to a truncated detail line when no known pattern matches.
 */
export const summarizeTorBootstrapStall = (
  detail: string | null | undefined,
  bootstrapPercent?: number | null,
): string | null => {
  const text = detail?.trim() ?? "";
  if (text.length === 0) {
    return null;
  }
  const stuckMatch = text.match(/Stuck at\s+(\d+)%/i);
  const percentFromDetail = stuckMatch ? Number(stuckMatch[1]) : null;
  const percent = typeof bootstrapPercent === "number" && Number.isFinite(bootstrapPercent)
    ? Math.floor(bootstrapPercent)
    : percentFromDetail;
  const percentLabel = typeof percent === "number" && percent >= 0 && percent < 100
    ? ` (~${percent}%)`
    : "";

  if (/\btls_error\b/i.test(text) || /\bunexpected eof\b/i.test(text)) {
    return `Tor bootstrap stuck${percentLabel}: network/TLS blocked to Tor relays (VPN, firewall, or DPI). Clearnet can still work — turn Tor off or try another network.`;
  }
  if (/\btimeout\b/i.test(text) || /\bwsaetimedout\b/i.test(text)) {
    return `Tor bootstrap stuck${percentLabel}: timed out reaching Tor relays (firewall, VPN, or blocked outbound). Clearnet can still work — turn Tor off or try another network/bridges.`;
  }
  if (/\bstuck at\b/i.test(text) || /\bproblem bootstrapping\b/i.test(text)) {
    return `Tor bootstrap stuck${percentLabel}: cannot finish Bootstrapped 100% on this network.`;
  }
  if (/waiting for bootstrapped 100%/i.test(text)) {
    return `Tor still waiting for Bootstrapped 100%${percentLabel}. On blocked networks this can stall indefinitely — turn Tor off to keep clearnet, or try another network/bridges.`;
  }
  if (text.length > 220) {
    return `${text.slice(0, 217)}…`;
  }
  return text;
};

export type TorBootstrapStallAssessment = Readonly<{
  stalled: boolean;
  reason: string | null;
  /** True when gateway explicitly reported Stuck / TLS_ERROR. */
  explicit: boolean;
}>;

/**
 * Decide whether Warming should flip to an honest stuck/degraded surface.
 * Dial policy stays clearnet either way until Ready.
 */
export const assessTorBootstrapStall = (params: Readonly<{
  preferenceOn: boolean;
  lifecycleReady: boolean;
  detail?: string | null;
  /** Recent tor-log lines — used when snapshot detail was wiped by restart. */
  logLines?: ReadonlyArray<string> | null;
  bootstrapPercent?: number | null;
  /** ms since preference turned on / last clear of Ready (caller-owned). */
  warmingElapsedMs?: number | null;
  softStallMs?: number;
}>): TorBootstrapStallAssessment => {
  if (!params.preferenceOn || params.lifecycleReady) {
    return { stalled: false, reason: null, explicit: false };
  }
  const detail = pickTorBootstrapStallDetail(params.detail, params.logLines);
  const explicit = isTorBootstrapStuckDetail(detail);
  const softStallMs = params.softStallMs ?? TOR_BOOTSTRAP_SOFT_STALL_MS;
  const elapsed = typeof params.warmingElapsedMs === "number" ? params.warmingElapsedMs : 0;
  const percent = typeof params.bootstrapPercent === "number" ? params.bootstrapPercent : null;
  const softStall = elapsed >= softStallMs
    && (percent === null || percent < 100);
  const stalled = explicit || softStall;
  if (!stalled) {
    return { stalled: false, reason: null, explicit: false };
  }
  return {
    stalled: true,
    explicit,
    reason: summarizeTorBootstrapStall(detail, params.bootstrapPercent)
      ?? "Tor is still starting with no usable bootstrap progress. Check network path or turn Tor off.",
  };
};
