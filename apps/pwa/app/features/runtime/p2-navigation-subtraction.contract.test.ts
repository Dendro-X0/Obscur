import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P2 navigation subtraction — programmatic exit checks (no manual soak).
 */
describe("p2 navigation subtraction contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("unmounts MainShell off the chat route (subtract hook fan-out)", () => {
    const chatShell = read("app/features/runtime/components/chat-route-main-shell.tsx");
    expect(chatShell).toContain("if (!isChatRoutePath(pathname))");
    expect(chatShell).toContain("return null");
    expect(chatShell).not.toContain('hidden={!onChatRoute}');
  });

  it("delegates intelligent warm-up to a single owner hook", () => {
    const appShell = read("app/components/app-shell.tsx");
    const warmupOwner = read("app/components/navigation-warmup-owner.ts");
    expect(appShell).toContain("useNavigationWarmupOwner");
    expect(appShell).not.toContain("runIntelligentNavigationWarmup");
    expect(warmupOwner).toContain("recordPathnameCommitted");
    expect(warmupOwner).toContain("runIntelligentNavigationWarmup");
    expect(warmupOwner).toContain("secondary_profile_window");
  });

  it("keeps global providers mounted in unlocked runtime shell", () => {
    const shell = read("app/features/runtime/components/unlocked-app-runtime-shell.tsx");
    expect(shell).toContain("MessagingProvider");
    expect(shell).toContain("RuntimeMessagingTransportOwnerProvider");
    expect(shell).not.toContain("RouteDomainProviders");
  });

  it("defers GlobalDialogManager until dialog open flags", () => {
    const lazyDialogs = read("app/features/messaging/components/lazy-global-dialog-manager.tsx");
    expect(lazyDialogs).toContain("isNewChatOpen");
    expect(lazyDialogs).toContain("isNewGroupOpen");
    expect(lazyDialogs).toContain("return null");
  });

  it("skips secondary-profile intelligent warm-up in app shell owner", () => {
    const warmupOwner = read("app/components/navigation-warmup-owner.ts");
    expect(warmupOwner).toContain("isSecondaryProfileWindow");
  });

  it("documents dev-webpack vs static compare scripts", () => {
    const pkg = readFileSync(path.resolve(pwaRoot, "..", "..", "package.json"), "utf8");
    expect(pkg).toContain("perf:v2:baseline:dev-webpack");
    expect(pkg).toContain("perf:v2:baseline:compare");
  });
});
