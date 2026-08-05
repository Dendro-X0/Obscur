import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

const W22_LEGACY_TARGETS = [
  "group-provider-legacy",
  "use-conversation-messages-legacy",
  "dm-conversation-hydrate-pipeline-legacy",
] as const;

/** Production surfaces routed through w22 ports — must not import legacy targets directly. */
const W22_ROUTED_PRODUCTION_PATHS = [
  "app/features/messaging/hooks/use-thread-messages.ts",
  "app/features/messaging/services/thread-history/dm-adapter.ts",
  "app/features/runtime/components/unlocked-app-runtime-shell.tsx",
  "app/features/runtime/components/route-domain-providers.tsx",
  "app/features/workspace-kernel/workspace-kernel-provider.tsx",
  "app/features/main-shell/main-shell.tsx",
  "app/features/network/components/network-dashboard.tsx",
  "app/groups/[...id]/group-home-page-client.tsx",
] as const;

describe("legacy subtraction w22 — kernel authority ports", () => {
  it("w22 production paths do not import w22 legacy targets directly", () => {
    for (const relativePath of W22_ROUTED_PRODUCTION_PATHS) {
      const source = read(relativePath);
      for (const target of W22_LEGACY_TARGETS) {
        expect(source, `${relativePath} must not import ${target}`).not.toContain(target);
      }
    }
  });

  it("group surfaces import group-provider-port", () => {
    const shell = read("app/features/runtime/components/unlocked-app-runtime-shell.tsx");
    expect(shell).toContain("group-provider-port");
    expect(shell).toContain("LegacyGroupProvider");
    expect(shell).not.toContain("group-provider-legacy");
  });

  it("use-thread-messages is dm-kernel or inert only (legacy UI hydrate deleted)", () => {
    const hook = read("app/features/messaging/hooks/use-thread-messages.ts");
    expect(hook).toContain("isDmKernelAuthority");
    expect(hook).toContain("useDmKernelThread");
    expect(hook).toContain("useInertConversationMessages");
    expect(hook).not.toContain("conversation-messages-legacy-port");
    expect(hook).not.toContain("use-conversation-messages-legacy");
    expect(hook).not.toContain("useLegacyConversationMessages");
  });

  it("dm thread history adapter is dm-kernel stub (Wave 2); resolver always stubs", () => {
    const adapter = read("app/features/messaging/services/thread-history/dm-adapter.ts");
    expect(adapter).toContain("dmKernelThreadHistoryStub");
    expect(adapter).not.toContain("dm-conversation-hydrate-pipeline-legacy");
    expect(adapter).not.toContain("runLegacyDmConversationHydrateReadModelPipeline");
    const resolver = read("app/features/messaging/services/thread-history/resolve-dm-thread-history-adapter.ts");
    expect(resolver).toContain("dmKernelThreadHistoryStub");
    expect(resolver).not.toContain("isObscurAllowLegacy");
    expect(resolver).not.toContain("resolveLegacyDmThreadHistoryAdapter");
  });
});
