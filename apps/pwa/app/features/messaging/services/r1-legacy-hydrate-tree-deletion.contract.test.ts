import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * R1-delete — UI hydrate tree gone; product = dm-kernel | inert.
 * Wave 4 — refuse owner deleted.
 * @see specs/backend/r1-legacy-hydrate-tree-deletion-design-2026-07.md
 * @see specs/backend/r1-wave4-refuse-tombstone-design-2026-07.md
 */

const APP_ROOT = join(__dirname, "../../..");
const PWA_ROOT = join(APP_ROOT, "..");

const readApp = (relativePath: string): string => (
  readFileSync(join(APP_ROOT, relativePath), "utf8")
);

describe("r1 legacy hydrate tree deletion", () => {
  it("thick UI hydrate hook file is gone", () => {
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/hooks/use-conversation-messages-legacy.ts"))).toBe(false);
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/conversation-hydrate-coordinator.ts"))).toBe(false);
  });

  it("useThreadMessages is kernel or inert only", () => {
    const source = readApp("features/messaging/hooks/use-thread-messages.ts");
    expect(source).toContain("useDmKernelThread");
    expect(source).toContain("useInertConversationMessages");
    expect(source).not.toContain("useLegacyConversationMessages");
    expect(source).not.toContain("shouldUseLegacyConversationMessagesHydrate");
    expect(source).not.toContain("conversation-messages-legacy-port");
  });

  it("legacy port permanently disables UI hydrate opt-in", () => {
    const source = readApp("features/messaging/hooks/conversation-messages-legacy-port.ts");
    expect(source).toContain("shouldUseLegacyConversationMessagesHydrate");
    expect(source).toMatch(/=>\s*false/);
    expect(source).not.toContain("use-conversation-messages-legacy");
    expect(source).not.toContain("isObscurAllowLegacy");
  });

  it("native DM hydrate refuse owner is deleted (Wave 4)", () => {
    expect(existsSync(join(APP_ROOT, "features/messaging/services/native-dm-conversation-hydrate-owner.ts"))).toBe(false);
    expect(existsSync(join(APP_ROOT, "features/messaging/services/native-dm-conversation-hydrate-port.ts"))).toBe(false);
  });
});
