import type { StandbyProbeResult } from "./standby-latency-prober";
import { probeStandbyRelayLatency } from "./standby-latency-prober";

/** Wait until after shell first paint before opening probe sockets. */
export const STANDBY_PROBE_INITIAL_DELAY_MS = 12_000;

/** Interval between full standby probe cycles. */
export const STANDBY_PROBE_INTERVAL_MS = 45_000;

/** Gap between consecutive probe sockets in one cycle. */
export const STANDBY_PROBE_INTER_URL_GAP_MS = 500;

export const sleep = (ms: number): Promise<void> => (
  new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  })
);

export type StandbyProbeCycleOptions = Readonly<{
  urls: ReadonlyArray<string>;
  isVisible?: () => boolean;
  probe?: (url: string) => Promise<StandbyProbeResult>;
  gapMs?: number;
}>;

/**
 * Probes standby relays one at a time with a gap so startup does not open many sockets at once.
 */
export const runStandbyRelayProbeCycle = async (
  options: StandbyProbeCycleOptions,
): Promise<ReadonlyArray<StandbyProbeResult>> => {
  const isVisible = options.isVisible ?? ((): boolean => (
    typeof document === "undefined" || document.visibilityState !== "hidden"
  ));
  const probe = options.probe ?? probeStandbyRelayLatency;
  const gapMs = options.gapMs ?? STANDBY_PROBE_INTER_URL_GAP_MS;
  const results: StandbyProbeResult[] = [];

  for (let index = 0; index < options.urls.length; index += 1) {
    if (!isVisible()) {
      break;
    }
    const url = options.urls[index];
    if (!url) {
      continue;
    }
    const result = await probe(url);
    results.push(result);
    if (index < options.urls.length - 1 && gapMs > 0) {
      await sleep(gapMs);
    }
  }

  return results;
};
