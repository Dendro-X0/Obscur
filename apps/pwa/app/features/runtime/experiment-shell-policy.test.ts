import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  EXPERIMENT_DEFER_HEAVY_WORK_MS,
  isExperimentOfflineStubEnabled,
  isExperimentOnlineEnabled,
  isExperimentShellEnabled,
  markExperimentShellBootFlag,
  scheduleExperimentDeferredWork,
  shouldDeferExperimentHeavyWork,
} from "./experiment-shell-policy";

describe("experiment-shell-policy", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("enables when NEXT_PUBLIC_OBSCUR_EXPERIMENT_SHELL=1", () => {
    delete process.env.NEXT_PUBLIC_DESKTOP_SHELL;
    process.env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_SHELL = "1";
    expect(isExperimentShellEnabled()).toBe(true);
  });

  it("enables by default on desktop shell builds", () => {
    delete process.env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_SHELL;
    process.env.NEXT_PUBLIC_DESKTOP_SHELL = "1";
    expect(isExperimentShellEnabled()).toBe(true);
  });

  it("is disabled when neither flag is set", () => {
    delete process.env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_SHELL;
    delete process.env.NEXT_PUBLIC_DESKTOP_SHELL;
    expect(isExperimentShellEnabled()).toBe(false);
  });

  it("online modules require NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE=1", () => {
    process.env.NEXT_PUBLIC_DESKTOP_SHELL = "1";
    delete process.env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE;
    expect(isExperimentOnlineEnabled()).toBe(false);
    expect(isExperimentOfflineStubEnabled()).toBe(true);
    expect(shouldDeferExperimentHeavyWork()).toBe(true);
    process.env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_ONLINE = "1";
    expect(isExperimentOnlineEnabled()).toBe(true);
    expect(isExperimentOfflineStubEnabled()).toBe(false);
    expect(shouldDeferExperimentHeavyWork()).toBe(false);
  });

  it("exports a defer interval for heavy work", () => {
    expect(EXPERIMENT_DEFER_HEAVY_WORK_MS).toBeGreaterThanOrEqual(5_000);
  });

  it("scheduleExperimentDeferredWork returns a cleanup function", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const cleanup = scheduleExperimentDeferredWork(callback);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(EXPERIMENT_DEFER_HEAVY_WORK_MS);
    expect(callback).toHaveBeenCalledTimes(1);
    cleanup();
    vi.useRealTimers();
  });

  it("markExperimentShellBootFlag sets window marker when desktop shell env is set", () => {
    process.env.NEXT_PUBLIC_DESKTOP_SHELL = "1";
    delete process.env.NEXT_PUBLIC_OBSCUR_EXPERIMENT_SHELL;
    delete window.__OBSCUR_EXPERIMENT_SHELL;
    markExperimentShellBootFlag();
    expect(window.__OBSCUR_EXPERIMENT_SHELL).toBe(true);
  });
});
