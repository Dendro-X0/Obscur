import { describe, expect, it } from "vitest";
import { DEV_LAB_SCENARIOS } from "./dev-lab-scenario-catalog";
import {
  DEV_LAB_CLI_ONLY_SCENARIO_IDS,
  DEV_LAB_SUITE_MANIFEST,
  DEV_LAB_TERMINAL_SCENARIO_IDS,
} from "./dev-lab-suite-manifest";

describe("dev-lab-suite-manifest", () => {
  it("lists every catalog scenario id exactly once across manifest suites", () => {
    const catalogIds = new Set(DEV_LAB_SCENARIOS.map((scenario) => scenario.id));
    const manifestIds = new Set([
      ...DEV_LAB_SUITE_MANIFEST.suites.smoke,
      ...DEV_LAB_SUITE_MANIFEST.suites.core,
      ...DEV_LAB_SUITE_MANIFEST.suites.full,
      ...DEV_LAB_SUITE_MANIFEST.cliOnly,
      ...DEV_LAB_SUITE_MANIFEST.terminal,
    ]);
    for (const id of catalogIds) {
      expect(manifestIds.has(id), `catalog scenario missing from manifest: ${id}`).toBe(true);
    }
  });

  it("keeps core messaging scenarios including dm-history-monotonic", () => {
    expect(DEV_LAB_SUITE_MANIFEST.suites.core).toContain("dm-history-monotonic");
    expect(DEV_LAB_SUITE_MANIFEST.suites.core).toContain("dm-reload-history");
  });

  it("marks cli-only and terminal scenarios", () => {
    expect(DEV_LAB_CLI_ONLY_SCENARIO_IDS.has("two-actor-dm")).toBe(true);
    expect(DEV_LAB_TERMINAL_SCENARIO_IDS.has("cold-reload")).toBe(true);
    expect(DEV_LAB_SUITE_MANIFEST.suites.core).not.toContain("cold-reload");
  });

  it("includes full-only scenarios in full suite", () => {
    expect(DEV_LAB_SUITE_MANIFEST.suites.full).toContain("search-profile-jump");
    expect(DEV_LAB_SUITE_MANIFEST.suites.full).toContain("vault-unlock");
    expect(DEV_LAB_SUITE_MANIFEST.suites.full).toContain("membership-leave-rejoin-zombie");
    expect(DEV_LAB_SUITE_MANIFEST.suites.full).toContain("sec-bot-keyword-flood");
    expect(DEV_LAB_SUITE_MANIFEST.suites.full).toContain("trust-fixtures");
    expect(DEV_LAB_SUITE_MANIFEST.suites.full).toContain("trust-cold-dm-banner");
    expect(DEV_LAB_SUITE_MANIFEST.suites.full).toContain("trust-live");
    expect(DEV_LAB_SUITE_MANIFEST.suites.full).toContain("sec-bot-inbound-live");
    expect(DEV_LAB_SUITE_MANIFEST.suites.full).toContain("auth4-scope-probe");
  });

  it("marks live CLI security scenarios as cli-only", () => {
    expect(DEV_LAB_CLI_ONLY_SCENARIO_IDS.has("membership-leave-rejoin-live")).toBe(true);
    expect(DEV_LAB_CLI_ONLY_SCENARIO_IDS.has("auth4-scope-probe-live")).toBe(true);
    expect(DEV_LAB_CLI_ONLY_SCENARIO_IDS.has("trust-live")).toBe(true);
    expect(DEV_LAB_CLI_ONLY_SCENARIO_IDS.has("sec-bot-inbound-live")).toBe(true);
  });
});
