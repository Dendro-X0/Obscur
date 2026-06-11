import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P4 — desktop bundle diet: no legacy hydrate in shipped shell paths.
 */
describe("p4 bundle diet contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("resolve adapter avoids static native hydrate imports", () => {
    const resolver = read("app/features/messaging/services/thread-history/resolve-dm-thread-history-adapter.ts");
    expect(resolver).not.toMatch(/from\s+["']\.\/native-dm-adapter["']/);
    expect(resolver).not.toMatch(/from\s+["']\.\/dm-adapter["']/);
    expect(resolver).toContain("isDesktopDmKernelShipBuild");
    expect(resolver).toContain("dmKernelThreadHistoryStub");
    expect(resolver).toContain("resolveLegacyDmThreadHistoryAdapter");
  });

  it("eslint config defines P4 desktop shell hydrate boundary", () => {
    const eslint = readFileSync(path.join(pwaRoot, "eslint.config.mjs"), "utf8");
    expect(eslint).toContain("P4: desktop runtime shell");
    expect(eslint).toContain("native-dm-thread-hydrate");
  });

  it("sidebar routes lazy-load in dev desktop and eager in production static", () => {
    const routes = read("app/lib/navigation/create-sidebar-route-page.tsx");
    expect(routes).toContain("shouldUseEagerDesktopSidebarRoute");
    expect(routes).toContain('process.env.NODE_ENV === "production"');
    expect(routes).toContain("createLazySidebarRoutePage");
  });

  it("documents release perf budget script", () => {
    const pkg = readFileSync(path.join(pwaRoot, "..", "..", "package.json"), "utf8");
    expect(pkg).toContain("perf:v2:release-budget");
    expect(pkg).toContain("verify:p4-bundle");
  });
});
