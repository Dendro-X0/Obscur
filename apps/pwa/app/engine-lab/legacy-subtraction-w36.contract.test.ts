import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("legacy subtraction w36 — conversation messages hook deleted", () => {
  it("conversation messages hook legacy file is tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/use-conversation-messages-legacy.ts",
    );
  });

  it("conversation messages hook legacy file stays deleted from app/legacy", () => {
    expect(existsSync(join(PWA_ROOT, "app/legacy/use-conversation-messages-legacy.ts"))).toBe(false);
  });

  it("features thick hook is deleted (R1-delete)", () => {
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/hooks/use-conversation-messages-legacy.ts"))).toBe(false);
  });

  it("conversation-messages-legacy-port is permanent-off tombstone", () => {
    const port = read("app/features/messaging/hooks/conversation-messages-legacy-port.ts");
    expect(port).toContain("shouldUseLegacyConversationMessagesHydrate");
    expect(port).toMatch(/=>\s*false/);
    expect(port).not.toContain("./use-conversation-messages-legacy");
    expect(port).not.toMatch(/@\/app\/legacy\//);
  });

  it("use-thread-messages does not import legacy hydrate port or hook", () => {
    const hook = read("app/features/messaging/hooks/use-thread-messages.ts");
    expect(hook).not.toContain("conversation-messages-legacy-port");
    expect(hook).not.toContain("useLegacyConversationMessages");
    expect(hook).not.toContain("@/app/legacy/use-conversation-messages-legacy");
    expect(hook).toContain("useDmKernelThread");
    expect(hook).toContain("useInertConversationMessages");
  });
});
