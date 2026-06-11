import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Legacy hydrate/projection stack — queued for removal after v2 slim proof gate.
 * Must stay marked @deprecated and must not re-enter native routing paths.
 */
describe("legacy deletion queue", () => {
  const pwaRoot = path.resolve(__dirname, "../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  const legacyNativeHydrateFiles = [
    "app/features/messaging/services/dm-conversation-hydrate-pipeline.ts",
    "app/features/messaging/services/dm-conversation-hydrate-read-model.ts",
    "app/features/messaging/services/dm-conversation-hydrate-indexed-scan.ts",
    "app/features/messaging/services/dm-conversation-hydrate-indexed-map-rows.ts",
    "app/features/messaging/services/dm-conversation-hydrate-sibling-diagnostics.ts",
    "app/features/messaging/services/native-dm-conversation-hydrate-owner.ts",
    "app/features/messaging/services/native-dm-thread-hydrate.ts",
    "app/features/messaging/services/dm-conversation-projection-evidence-messages.ts",
    "app/features/messaging/services/dm-conversation-projection-live-merge.ts",
  ] as const;

  it("legacy hydrate/projection files are marked @deprecated with dm-kernel pointer", () => {
    for (const relativePath of legacyNativeHydrateFiles) {
      const source = read(relativePath);
      expect(source, relativePath).toContain("@deprecated");
      expect(source, relativePath).toMatch(/dm-kernel|obscur-v2-slim-kernel-manifest/i);
    }
  });

  it("use-conversation-messages remains inert on native via use-thread-messages kernel bypass", () => {
    const threadMessages = read("app/features/messaging/hooks/use-thread-messages.ts");
    expect(threadMessages).toContain("useDmKernelThread");
    expect(threadMessages).toContain("useConversationMessages(kernel ? undefined : displayDmId");
  });

  it("messaging-provider routes sidebar through dm-kernel when kernel authority is active", () => {
    const source = read("app/features/messaging/providers/messaging-provider.tsx");
    expect(source).toContain("isDmKernelAuthority");
    expect(source).toContain("loadDmKernelSidebar");
  });
});
