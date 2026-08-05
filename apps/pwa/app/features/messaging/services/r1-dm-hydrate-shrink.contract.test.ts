import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * R1 — product DM read = dm-kernel; legacy UI hydrate tree deleted (R1-delete).
 * Wave 4 — refuse tombstone deleted (no remaining native hydrate owner).
 * @see specs/backend/r1-dm-hydrate-shrink-design-2026-07.md
 * @see specs/backend/r1-legacy-hydrate-tree-deletion-design-2026-07.md
 * @see specs/backend/r1-wave4-refuse-tombstone-design-2026-07.md
 */

const APP_ROOT = join(__dirname, "../../..");

const readApp = (relativePath: string): string => (
  readFileSync(join(APP_ROOT, relativePath), "utf8")
);

describe("r1 dm hydrate shrink", () => {
  it("useThreadMessages prefers dm-kernel (no legacy UI hydrate branch)", () => {
    const source = readApp("features/messaging/hooks/use-thread-messages.ts");
    expect(source).toContain("useDmKernelThread");
    expect(source).toContain("isDmKernelAuthority");
    expect(source).toContain("useInertConversationMessages");
    expect(source).not.toContain("useLegacyConversationMessages");
  });

  it("legacy hydrate port is permanently off", () => {
    const source = readApp("features/messaging/hooks/conversation-messages-legacy-port.ts");
    expect(source).toContain("shouldUseLegacyConversationMessagesHydrate");
    expect(source).toMatch(/=>\s*false/);
  });

  it("ChatView props route threads through useThreadMessages", () => {
    const source = readApp("features/main-shell/hooks/use-chat-view-props.ts");
    expect(source).toContain("useThreadMessages");
    expect(source).not.toContain("useLegacyConversationMessages(");
  });

  it("native DM hydrate refuse owner is deleted (Wave 4)", () => {
    expect(existsSync(join(APP_ROOT, "features/messaging/services/native-dm-conversation-hydrate-owner.ts"))).toBe(false);
    expect(existsSync(join(APP_ROOT, "features/messaging/services/native-dm-conversation-hydrate-port.ts"))).toBe(false);
  });
});
