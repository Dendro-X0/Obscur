import { logWithRateLimit } from "@/app/shared/log-hygiene";

export type RuntimeLogClassification = "expected" | "degraded" | "actionable";
export type RuntimeLogLevel = "debug" | "info" | "warn" | "error";

export type RuntimeLogPolicy = Readonly<{
  level: RuntimeLogLevel;
  windowMs: number;
  maxPerWindow: number;
  summaryEverySuppressed: number;
}>;

const POLICY_BY_CLASSIFICATION: Readonly<Record<RuntimeLogClassification, RuntimeLogPolicy>> = {
  expected: {
    level: "debug",
    windowMs: 30_000,
    maxPerWindow: 1,
    summaryEverySuppressed: 25,
  },
  degraded: {
    level: "info",
    windowMs: 20_000,
    maxPerWindow: 2,
    summaryEverySuppressed: 20,
  },
  actionable: {
    level: "warn",
    windowMs: 15_000,
    maxPerWindow: 3,
    summaryEverySuppressed: 10,
  },
};

export const getRuntimeLogPolicy = (classification: RuntimeLogClassification): RuntimeLogPolicy =>
  POLICY_BY_CLASSIFICATION[classification];

export const logRuntimeEvent = (
  key: string,
  classification: RuntimeLogClassification,
  args: ReadonlyArray<unknown>,
  overrides?: Partial<RuntimeLogPolicy>
): void => {
  const base = getRuntimeLogPolicy(classification);
  logWithRateLimit(base.level, key, args, {
    windowMs: overrides?.windowMs ?? base.windowMs,
    maxPerWindow: overrides?.maxPerWindow ?? base.maxPerWindow,
    summaryEverySuppressed: overrides?.summaryEverySuppressed ?? base.summaryEverySuppressed,
  });
};

