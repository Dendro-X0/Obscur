import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Native DM routing must not import hydrate pipeline modules.
 * Web legacy may keep them; native path goes through dm-kernel only.
 */
describe("v2 slim native routing quarantine", () => {
  const pwaRoot = path.resolve(__dirname, "../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  const nativeRoutingFiles = [
    "app/features/messaging/hooks/use-thread-messages.ts",
    "app/features/messaging/services/native-dm-read-policy.ts",
    "app/features/messaging/services/native-dm-conversation-list-owner.ts",
    "app/features/messaging/providers/messaging-provider.tsx",
    "app/features/messaging/services/message-persistence-service.ts",
    "app/features/dm-kernel/dm-kernel-thread-port.ts",
    "app/features/dm-kernel/dm-kernel-write-port.ts",
    "app/features/dm-kernel/dm-kernel-repair.ts",
    "app/features/dm-kernel/use-dm-kernel-thread.ts",
  ];

  const forbiddenImportFragments = [
    "dm-conversation-hydrate-pipeline",
    "dm-conversation-hydrate-read-model",
    "assembleDmHydrateThreadReadModel",
    "runDmConversationHydrateReadModelPipeline",
    "resolveHydrationDmReadMessages",
    "native-dm-conversation-hydrate-owner",
    "dm-conversation-projection-live-merge",
    "dm-conversation-projection-evidence-messages",
  ];

  it("native routing files do not import hydrate pipeline symbols", () => {
    const combined = nativeRoutingFiles.map(read).join("\n");
    for (const token of forbiddenImportFragments) {
      expect(combined).not.toContain(token);
    }
  });

  it("use-thread-messages keeps legacy hook inert on native (undefined conversation id)", () => {
    const source = read("app/features/messaging/hooks/use-thread-messages.ts");
    expect(source).toContain("useLegacyConversationMessages(");
    expect(source).toContain("legacyHydrate ? displayDmId : undefined");
  });

  it("use-thread-messages routes through dm-kernel authority", () => {
    const source = read("app/features/messaging/hooks/use-thread-messages.ts");
    expect(source).toContain("isDmKernelAuthority");
    expect(source).toContain("useDmKernelThread");
  });
});
