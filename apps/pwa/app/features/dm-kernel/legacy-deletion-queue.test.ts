import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("legacy deletion queue", () => {
  const pwaRoot = path.resolve(__dirname, "../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("use-conversation-messages legacy hook lives in features behind port", () => {
    const port = read("app/features/messaging/hooks/conversation-messages-legacy-port.ts");
    const hook = read("app/features/messaging/hooks/use-conversation-messages-legacy.ts");
    expect(port).toContain("./use-conversation-messages-legacy");
    expect(hook).toContain("useLegacyConversationMessages");
    expect(hook).not.toMatch(/@\/app\/legacy\//);
  });

  it("use-conversation-messages legacy remains inert on native via use-thread-messages kernel bypass", () => {
    const threadMessages = read("app/features/messaging/hooks/use-thread-messages.ts");
    expect(threadMessages).toContain("useDmKernelThread");
    expect(threadMessages).toContain("legacyHydrate ? displayDmId : undefined");
    expect(threadMessages).toContain("useInertConversationMessages");
  });

  it("messaging-provider routes sidebar through dm-kernel when kernel authority is active", () => {
    const source = read("app/features/messaging/providers/messaging-provider.tsx");
    expect(source).toContain("isDmKernelAuthority");
    expect(source).toContain("loadDmKernelSidebar");
  });
});
