import manifest from "./dev-lab-suite-manifest.json";
import type { DevLabSuiteId } from "./dev-lab-types";

export type DevLabSuiteManifest = Readonly<{
  schema: string;
  cliOnly: ReadonlyArray<string>;
  terminal: ReadonlyArray<string>;
  suites: Readonly<Record<DevLabSuiteId, ReadonlyArray<string>>>;
}>;

export const DEV_LAB_SUITE_MANIFEST = manifest as DevLabSuiteManifest;

export const DEV_LAB_CLI_ONLY_SCENARIO_IDS = new Set<string>(DEV_LAB_SUITE_MANIFEST.cliOnly);
export const DEV_LAB_TERMINAL_SCENARIO_IDS = new Set<string>(DEV_LAB_SUITE_MANIFEST.terminal);
