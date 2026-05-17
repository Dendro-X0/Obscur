"use client";

import { useSyncExternalStore } from "react";

const FRAME_DROP_THRESHOLD_MS = 50;
const FRAME_LAG_SPIKE_THRESHOLD_MS = 120;
const MONITOR_FLUSH_INTERVAL_MS = 1_000;
const MEMORY_SAMPLE_INTERVAL_MS = 15_000;

type Listener = () => void;

export type UiResponsivenessSnapshot = Readonly<{
  startedAtUnixMs: number;
  updatedAtUnixMs: number;
  droppedFrameCount: number;
  frameLagSpikeCount: number;
  worstFrameGapMs: number;
  lastFrameLagAtUnixMs: number | null;
  longTaskCount: number;
  longTaskTotalDurationMs: number;
  longTaskWorstDurationMs: number;
  lastLongTaskAtUnixMs: number | null;
  longTaskSupported: boolean;
  memorySupported: boolean;
  heapUsedBytes: number | null;
  heapTotalBytes: number | null;
  heapLimitBytes: number | null;
  lastMemorySampleAtUnixMs: number | null;
}>;

const nowUnixMs = (): number => Date.now();

export const createUiResponsivenessSnapshot = (
  startedAtUnixMs: number = nowUnixMs(),
): UiResponsivenessSnapshot => ({
  startedAtUnixMs,
  updatedAtUnixMs: startedAtUnixMs,
  droppedFrameCount: 0,
  frameLagSpikeCount: 0,
  worstFrameGapMs: 0,
  lastFrameLagAtUnixMs: null,
  longTaskCount: 0,
  longTaskTotalDurationMs: 0,
  longTaskWorstDurationMs: 0,
  lastLongTaskAtUnixMs: null,
  longTaskSupported: false,
  memorySupported: false,
  heapUsedBytes: null,
  heapTotalBytes: null,
  heapLimitBytes: null,
  lastMemorySampleAtUnixMs: null,
});

export const applyFrameGapSample = (
  snapshot: UiResponsivenessSnapshot,
  frameGapMs: number,
  atUnixMs: number,
): UiResponsivenessSnapshot => {
  if (frameGapMs < FRAME_DROP_THRESHOLD_MS) {
    return snapshot;
  }
  const isSpike = frameGapMs >= FRAME_LAG_SPIKE_THRESHOLD_MS;
  return {
    ...snapshot,
    droppedFrameCount: snapshot.droppedFrameCount + 1,
    frameLagSpikeCount: isSpike ? snapshot.frameLagSpikeCount + 1 : snapshot.frameLagSpikeCount,
    worstFrameGapMs: Math.max(snapshot.worstFrameGapMs, frameGapMs),
    lastFrameLagAtUnixMs: atUnixMs,
  };
};

export const applyLongTaskSample = (
  snapshot: UiResponsivenessSnapshot,
  durationMs: number,
  atUnixMs: number,
): UiResponsivenessSnapshot => ({
  ...snapshot,
  longTaskCount: snapshot.longTaskCount + 1,
  longTaskTotalDurationMs: snapshot.longTaskTotalDurationMs + durationMs,
  longTaskWorstDurationMs: Math.max(snapshot.longTaskWorstDurationMs, durationMs),
  lastLongTaskAtUnixMs: atUnixMs,
});

const listeners = new Set<Listener>();

let snapshot: UiResponsivenessSnapshot = createUiResponsivenessSnapshot();
let workingSnapshot: UiResponsivenessSnapshot = snapshot;
let started = false;
let flushIntervalId: number | null = null;
let memoryIntervalId: number | null = null;
let frameHandle: number | null = null;
let longTaskObserver: PerformanceObserver | null = null;
let dirty = false;

const emit = (): void => {
  listeners.forEach((listener) => listener());
};

const syncWindowDebugHandle = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  (window as Window & { obscurUiResponsiveness?: unknown }).obscurUiResponsiveness = {
    getSnapshot: () => snapshot,
    reset: () => uiResponsivenessMonitor.reset(),
    start: () => uiResponsivenessMonitor.start(),
    stop: () => uiResponsivenessMonitor.stop(),
  };
};

const publish = (): void => {
  if (!dirty) {
    return;
  }
  snapshot = {
    ...workingSnapshot,
    updatedAtUnixMs: nowUnixMs(),
  };
  dirty = false;
  syncWindowDebugHandle();
  emit();
};

const markDirty = (): void => {
  dirty = true;
};

const sampleMemory = (): void => {
  if (typeof performance === "undefined") {
    return;
  }
  const perf = performance as Performance & {
    memory?: Readonly<{
      usedJSHeapSize?: number;
      totalJSHeapSize?: number;
      jsHeapSizeLimit?: number;
    }>;
  };
  const memory = perf.memory;
  if (!memory) {
    return;
  }
  workingSnapshot = {
    ...workingSnapshot,
    memorySupported: true,
    heapUsedBytes: typeof memory.usedJSHeapSize === "number" ? memory.usedJSHeapSize : null,
    heapTotalBytes: typeof memory.totalJSHeapSize === "number" ? memory.totalJSHeapSize : null,
    heapLimitBytes: typeof memory.jsHeapSizeLimit === "number" ? memory.jsHeapSizeLimit : null,
    lastMemorySampleAtUnixMs: nowUnixMs(),
  };
  markDirty();
};

const startFrameLoop = (): void => {
  if (typeof window === "undefined" || typeof performance === "undefined") {
    return;
  }
  let lastFrameAt = performance.now();
  const onFrame = (nowMs: number): void => {
    const frameGapMs = Math.max(0, nowMs - lastFrameAt);
    lastFrameAt = nowMs;
    const next = applyFrameGapSample(workingSnapshot, frameGapMs, nowUnixMs());
    if (next !== workingSnapshot) {
      workingSnapshot = next;
      markDirty();
    }
    frameHandle = window.requestAnimationFrame(onFrame);
  };
  frameHandle = window.requestAnimationFrame(onFrame);
};

const stopFrameLoop = (): void => {
  if (typeof window === "undefined" || frameHandle === null) {
    return;
  }
  window.cancelAnimationFrame(frameHandle);
  frameHandle = null;
};

const startLongTaskObserver = (): void => {
  if (typeof PerformanceObserver === "undefined") {
    workingSnapshot = {
      ...workingSnapshot,
      longTaskSupported: false,
    };
    markDirty();
    return;
  }
  try {
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      if (entries.length === 0) {
        return;
      }
      let next = workingSnapshot;
      const atUnixMs = nowUnixMs();
      for (const entry of entries) {
        next = applyLongTaskSample(next, entry.duration, atUnixMs);
      }
      if (next !== workingSnapshot) {
        workingSnapshot = next;
        markDirty();
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
    longTaskObserver = observer;
    workingSnapshot = {
      ...workingSnapshot,
      longTaskSupported: true,
    };
    markDirty();
  } catch {
    workingSnapshot = {
      ...workingSnapshot,
      longTaskSupported: false,
    };
    markDirty();
  }
};

const stopLongTaskObserver = (): void => {
  if (!longTaskObserver) {
    return;
  }
  longTaskObserver.disconnect();
  longTaskObserver = null;
};

export const uiResponsivenessMonitor = {
  start(): void {
    if (started || typeof window === "undefined") {
      return;
    }
    started = true;
    syncWindowDebugHandle();
    startFrameLoop();
    startLongTaskObserver();
    sampleMemory();
    flushIntervalId = window.setInterval(publish, MONITOR_FLUSH_INTERVAL_MS);
    memoryIntervalId = window.setInterval(sampleMemory, MEMORY_SAMPLE_INTERVAL_MS);
  },
  stop(): void {
    if (!started || typeof window === "undefined") {
      return;
    }
    started = false;
    stopFrameLoop();
    stopLongTaskObserver();
    if (flushIntervalId !== null) {
      window.clearInterval(flushIntervalId);
      flushIntervalId = null;
    }
    if (memoryIntervalId !== null) {
      window.clearInterval(memoryIntervalId);
      memoryIntervalId = null;
    }
    publish();
  },
  reset(): void {
    const fresh = createUiResponsivenessSnapshot(nowUnixMs());
    snapshot = fresh;
    workingSnapshot = fresh;
    dirty = false;
    syncWindowDebugHandle();
    emit();
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): UiResponsivenessSnapshot {
    return snapshot;
  },
};

export const useUiResponsivenessSnapshot = (): UiResponsivenessSnapshot =>
  useSyncExternalStore(uiResponsivenessMonitor.subscribe, uiResponsivenessMonitor.getSnapshot, uiResponsivenessMonitor.getSnapshot);

export const uiResponsivenessMonitorInternals = {
  resetForTests: (): void => {
    uiResponsivenessMonitor.stop();
    const fresh = createUiResponsivenessSnapshot(nowUnixMs());
    snapshot = fresh;
    workingSnapshot = fresh;
    dirty = false;
    listeners.clear();
  },
};
