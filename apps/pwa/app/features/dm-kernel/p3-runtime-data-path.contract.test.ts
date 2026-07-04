import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P3 exit contract — dm-kernel SQLite invoke discipline.
 */
describe("p3 runtime data path contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("routes native thread reads through dm-kernel engine port", () => {
    const port = read("app/features/dm-kernel/dm-kernel-thread-port.ts");
    expect(port).toContain("fetchDmThreadRows");
    expect(port).toContain("isEngineLabStrictMode");
    expect(port).toContain("recordDmKernelInvoke");
    expect(port).toContain("readDmKernelThreadSessionCache");
    expect(port).not.toContain("chat-state-store");
  });

  it("routes native sidebar reads through loadDmKernelSidebar", () => {
    const provider = read("app/features/messaging/providers/messaging-provider.tsx");
    expect(provider).toContain("loadDmKernelSidebar");
    const sidebar = read("app/features/dm-kernel/dm-kernel-sidebar-port.ts");
    expect(sidebar).toContain("listDmConversations");
    expect(sidebar).toContain("recordDmKernelInvoke");
    expect(sidebar).not.toContain("chat-state-store");
  });

  it("keeps hydrate stub under dm-kernel authority", () => {
    const resolver = read("app/features/messaging/services/thread-history/resolve-dm-thread-history-adapter.ts");
    expect(resolver).toContain("dmKernelThreadHistoryStub");
  });

  it("documents thread-open sqlite budget helper", () => {
    const audit = read("app/features/dm-kernel/dm-kernel-invoke-audit.ts");
    expect(audit).toContain("evaluateDmKernelThreadOpenBudget");
    expect(audit).toContain("messages_initial");
    expect(audit).toContain("messages_pagination");
  });

  it("uses session cache to survive MainShell remount without duplicate sqlite read", () => {
    const cache = read("app/features/dm-kernel/dm-kernel-thread-session-cache.ts");
    expect(cache).toContain("invalidateConversation");
    expect(cache).toContain("messageBus.subscribe");
  });
});
