/**
 * Slice 3 lag: count Tauri invoke IPC by command name.
 * E8: Quiet=0 + emit-pressure=0 still PostMessage-flooded — suspect invoke round-trips.
 */

const counts = new Map<string, number>();
let total = 0;
let lastReportAtMs = 0;

const REPORT_EVERY_MS = 2_000;

export const noteInvokePressure = (command: string): void => {
  total += 1;
  counts.set(command, (counts.get(command) ?? 0) + 1);
  const now = Date.now();
  if (lastReportAtMs === 0) {
    lastReportAtMs = now;
    return;
  }
  if (now - lastReportAtMs < REPORT_EVERY_MS) {
    return;
  }
  lastReportAtMs = now;
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const top = ranked.map(([name, count]) => `${name}=${count}`).join(" ");
  // Visible in desktop terminal via webview console bridge when present; also window debug.
  const line = `[invoke-pressure] total=${total} top=[${top}]`;
  console.info(line);
  if (typeof window !== "undefined") {
    (window as Window & { __obscurInvokePressure?: string }).__obscurInvokePressure = line;
  }
};

export const resetInvokePressureForTests = (): void => {
  counts.clear();
  total = 0;
  lastReportAtMs = 0;
};
