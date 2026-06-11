import type { DevLabAccountId } from "./dev-lab-accounts";
import type { DevLabShellHealth } from "./dev-lab-shell-health";

export const DEV_LAB_BENCHMARK_SCHEMA = "obscur.dev-lab.benchmark.v1";

export type DevLabScenarioCategory =
  | "auth"
  | "shell"
  | "navigation"
  | "settings"
  | "runtime"
  | "messaging"
  | "network";

export type DevLabScenarioStepResult = Readonly<{
  id: string;
  passed: boolean;
  message: string;
  durationMs: number;
  context?: Readonly<Record<string, unknown>>;
}>;

export type DevLabScenarioResult = Readonly<{
  id: string;
  name: string;
  category: DevLabScenarioCategory;
  passed: boolean;
  durationMs: number;
  steps: ReadonlyArray<DevLabScenarioStepResult>;
  error?: string;
  failureArtifacts?: DevLabScenarioFailureArtifacts;
}>;

export type DevLabScenarioFailureArtifacts = Readonly<{
  screenshotFile: string | null;
  pathname: string;
  failedStepIds: ReadonlyArray<string>;
  shellHealth: DevLabShellHealth | null;
  digestSummary: Readonly<Record<string, unknown>> | null;
}>;

export type DevLabBenchmarkReport = Readonly<{
  schema: typeof DEV_LAB_BENCHMARK_SCHEMA;
  version: string;
  generatedAtUnixMs: number;
  suite: string;
  surface: "in-app" | "playwright" | "cdp";
  baseUrl: string;
  passed: boolean;
  scenarios: ReadonlyArray<DevLabScenarioResult>;
  summary: Readonly<{
    total: number;
    passed: number;
    failed: number;
    failedScenarioIds: ReadonlyArray<string>;
    categories: Readonly<Record<DevLabScenarioCategory, Readonly<{ total: number; passed: number }>>>;
  }>;
  shellHealth: DevLabShellHealth | null;
  capture: Readonly<{
    m0: unknown | null;
    digest: unknown | null;
  }> | null;
}>;

export type DevLabScenarioContext = Readonly<{
  unlock: (accountId?: DevLabAccountId) => Promise<void>;
  delay: (ms: number) => Promise<void>;
}>;

export type DevLabScenarioDefinition = Readonly<{
  id: string;
  name: string;
  category: DevLabScenarioCategory;
  tags: ReadonlyArray<string>;
  run: (ctx: DevLabScenarioContext) => Promise<ReadonlyArray<DevLabScenarioStepResult>>;
}>;

export type DevLabSuiteId = "smoke" | "core" | "full";
