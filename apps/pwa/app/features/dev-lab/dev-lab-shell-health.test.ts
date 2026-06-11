import { describe, expect, it } from "vitest";
import { isDevLabEnabled } from "./dev-lab-policy";
import { probeDevLabShellHealth, devLabShellHealthInternals } from "./dev-lab-shell-health";

describe("dev-lab-shell-health", () => {
  it("detects root fatal error boundary via DOM marker", () => {
    document.body.innerHTML = `
      <div data-testid="${devLabShellHealthInternals.ROOT_BOUNDARY_TEST_ID}">
        <h1>Oops! Something went wrong</h1>
      </div>
    `;
    const health = probeDevLabShellHealth();
    expect(health.rootFatalBoundary).toBe(true);
    expect(health.healthy).toBe(false);
    expect(health.issues).toContain("root_fatal_error_boundary");
  });

  it("detects unlocked shell via sidebar aria-label links", () => {
    document.body.innerHTML = `
      <nav>
        <a aria-label="Settings" href="/settings">S</a>
        <a aria-label="Network" href="/network">N</a>
      </nav>
    `;
    const health = probeDevLabShellHealth();
    expect(health.shellUnlocked).toBe(true);
    expect(health.healthy).toBe(true);
  });

  it("detects unlocked shell on settings route without main sidebar", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { pathname: "/settings" },
    });
    document.body.innerHTML = `
      <button type="button" data-settings-tab="relays">Relays</button>
      <div data-testid="settings-tab-panel-relays">panel</div>
    `;
    const health = probeDevLabShellHealth();
    expect(health.shellUnlocked).toBe(true);
    expect(health.healthy).toBe(true);
  });

  it("detects global fatal boundary flag", () => {
    (window as Window & { __OBSCUR_FATAL_BOUNDARY__?: { active: boolean; message: string } })
      .__OBSCUR_FATAL_BOUNDARY__ = { active: true, message: "Maximum update depth exceeded" };
    const health = probeDevLabShellHealth();
    expect(health.rootFatalBoundary).toBe(true);
    expect(health.fatalBoundaryMessage).toContain("Maximum update depth");
    delete (window as Window & { __OBSCUR_FATAL_BOUNDARY__?: unknown }).__OBSCUR_FATAL_BOUNDARY__;
  });
});

describe("dev-lab-policy", () => {
  it("is enabled in test environment", () => {
    expect(isDevLabEnabled()).toBe(true);
  });
});
