import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("legacy deletion queue", () => {
  const pwaRoot = path.resolve(__dirname, "../../..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("use-conversation-messages thick legacy hook is deleted", () => {
    expect(existsSync(path.join(pwaRoot, "app/features/messaging/hooks/use-conversation-messages-legacy.ts"))).toBe(false);
    const port = read("app/features/messaging/hooks/conversation-messages-legacy-port.ts");
    expect(port).toContain("shouldUseLegacyConversationMessagesHydrate");
    expect(port).toMatch(/=>\s*false/);
    expect(port).not.toContain("./use-conversation-messages-legacy");
  });

  it("use-thread-messages is dm-kernel or inert only", () => {
    const threadMessages = read("app/features/messaging/hooks/use-thread-messages.ts");
    expect(threadMessages).toContain("useDmKernelThread");
    expect(threadMessages).toContain("useInertConversationMessages");
    expect(threadMessages).not.toContain("useLegacyConversationMessages");
    expect(threadMessages).not.toContain("legacyHydrate");
  });

  it("messaging-provider routes sidebar through protocol adaptation", () => {
    const source = read("app/features/messaging/providers/messaging-provider.tsx");
    expect(source).toContain("listDmConversations");
    expect(source).toContain("protocol-adaptation");
    expect(source).not.toContain("dm-kernel-sidebar-port");
  });
});
