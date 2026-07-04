import { describe, expect, it } from "vitest";
import { DEV_LAB_SUITE_SCENARIOS, resolveDevLabScenario } from "./dev-lab-scenario-catalog";
import { runDevLabScenario } from "./dev-lab-scenario-runner";
import { probeDevLabShellHealth, devLabShellHealthInternals } from "./dev-lab-shell-health";

describe("dev-lab-scenario-catalog", () => {
  it("includes relay, dm, and digest scenarios in core suite", () => {
    expect(DEV_LAB_SUITE_SCENARIOS.core).toContain("relay-toggle-stress");
    expect(DEV_LAB_SUITE_SCENARIOS.core).toContain("dm-send-synthetic");
    expect(DEV_LAB_SUITE_SCENARIOS.core).toContain("dm-history-monotonic");
    expect(DEV_LAB_SUITE_SCENARIOS.core).toContain("dm-reload-history");
    expect(DEV_LAB_SUITE_SCENARIOS.core).toContain("digest-membership-gates");
    expect(DEV_LAB_SUITE_SCENARIOS.core).toContain("trust-matrix");
    expect(DEV_LAB_SUITE_SCENARIOS.core).not.toContain("search-profile-jump");
  });

  it("includes extended navigation and stub scenarios in full suite", () => {
    expect(DEV_LAB_SUITE_SCENARIOS.full).toContain("search-profile-jump");
    expect(DEV_LAB_SUITE_SCENARIOS.full).toContain("group-stub-send");
    expect(DEV_LAB_SUITE_SCENARIOS.full).toContain("vault-unlock");
    expect(DEV_LAB_SUITE_SCENARIOS.full).toContain("membership-leave-rejoin-zombie");
    expect(DEV_LAB_SUITE_SCENARIOS.full).toContain("sec-bot-keyword-flood");
    expect(DEV_LAB_SUITE_SCENARIOS.full).toContain("trust-fixtures");
    expect(DEV_LAB_SUITE_SCENARIOS.full).not.toContain("trust-cold-dm-banner");
    expect(DEV_LAB_SUITE_SCENARIOS.full).toContain("auth4-scope-probe");
  });

  it("resolves known scenarios", () => {
    expect(resolveDevLabScenario("auth-unlock")?.category).toBe("auth");
    expect(resolveDevLabScenario("missing")).toBeNull();
  });
});

describe("dev-lab-scenario-runner", () => {
  it("fails unknown scenarios", async () => {
    const result = await runDevLabScenario("does-not-exist", {
      unlock: async () => undefined,
      delay: async () => undefined,
    });
    expect(result.passed).toBe(false);
    expect(result.error).toContain("Unknown scenario");
  });

  it("runs shell-health scenario against DOM", async () => {
    document.body.innerHTML = `
      <nav><a aria-label="Settings" href="/settings">S</a></nav>
    `;
    const result = await runDevLabScenario("shell-health", {
      unlock: async () => undefined,
      delay: async () => undefined,
    });
    expect(result.passed).toBe(true);
  });

  it("fails shell-health when fatal boundary is active", async () => {
    document.body.innerHTML = `
      <div data-testid="${devLabShellHealthInternals.ROOT_BOUNDARY_TEST_ID}">
        <h1>Oops! Something went wrong</h1>
      </div>
    `;
    const result = await runDevLabScenario("shell-health", {
      unlock: async () => undefined,
      delay: async () => undefined,
    });
    expect(result.passed).toBe(false);
    expect(probeDevLabShellHealth().rootFatalBoundary).toBe(true);
  });
});
