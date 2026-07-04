import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ENGINE_LAB_QUARANTINE_TARGETS,
  ENGINE_LAB_SUBTRACTED_FILES,
} from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

/** w14–w18 subtracted features → legacy + types facades. */
const W14_W18_LEGACY_RELOCATIONS = [
  {
    subtracted: "app/features/relays/hooks/enhanced-relay-pool.ts",
    legacy: "app/legacy/enhanced-relay-pool-legacy.ts",
    canonical: "app/features/relays/hooks/enhanced-relay-pool-legacy.ts",
    types: "app/features/relays/hooks/enhanced-relay-pool-types.ts",
  },
  {
    subtracted: "app/features/groups/hooks/use-sealed-community.ts",
    legacy: "app/legacy/use-sealed-community-legacy.ts",
    canonical: "app/features/groups/hooks/use-sealed-community-legacy.ts",
    types: "app/features/groups/hooks/use-sealed-community-types.ts",
  },
  {
    subtracted: "app/features/groups/providers/group-provider.tsx",
    legacy: "app/legacy/group-provider-legacy.tsx",
    canonical: "app/features/groups/providers/group-provider-legacy.tsx",
    types: "app/features/groups/providers/group-provider-types.ts",
  },
  {
    subtracted: "app/features/messaging/services/chat-state-store.ts",
    legacy: "app/legacy/chat-state-store-legacy.ts",
    canonical: "app/features/messaging/services/chat-state-store-legacy.ts",
    types: "app/features/messaging/services/chat-state-store-types.ts",
  },
] as const;

describe("legacy subtraction B5 exit — quarantine complete", () => {
  it("active quarantine is empty after w18", () => {
    expect(ENGINE_LAB_QUARANTINE_TARGETS).toEqual([]);
  });

  it("manifest tombstone count matches w18 gate (74 paths)", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES.length).toBeGreaterThanOrEqual(74);
    for (const entry of W14_W18_LEGACY_RELOCATIONS) {
      expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(entry.subtracted);
    }
  });

  it("w14–w18 legacy implementations and type facades exist", () => {
    for (const entry of W14_W18_LEGACY_RELOCATIONS) {
      if ("canonical" in entry) {
        expect(existsSync(join(PWA_ROOT, entry.legacy)), entry.legacy).toBe(false);
        expect(existsSync(join(PWA_ROOT, entry.canonical)), entry.canonical).toBe(true);
      } else {
        expect(existsSync(join(PWA_ROOT, entry.legacy)), entry.legacy).toBe(true);
      }
      expect(existsSync(join(PWA_ROOT, entry.types)), entry.types).toBe(true);
      expect(existsSync(join(PWA_ROOT, entry.subtracted)), entry.subtracted).toBe(false);
    }
  });

  it("verify-legacy-subtraction.mjs parses manifest tombstones", () => {
    const script = readFileSync(join(REPO_ROOT, "scripts/verify-legacy-subtraction.mjs"), "utf8");
    expect(script).toContain("legacy-subtraction-manifest.ts");
    expect(script).toContain("ENGINE_LAB_SUBTRACTED_FILES");
  });

  it("dm-kernel and obscur packages do not import subtracted chat-state-store path", () => {
    const dmKernelPolicy = read("app/features/dm-kernel/dm-kernel-policy.ts");
    expect(dmKernelPolicy).not.toMatch(/features\/messaging\/services\/chat-state-store["']/);
    const transportTypes = readFileSync(
      join(REPO_ROOT, "packages/obscur-transport-engine/src/transport-types.ts"),
      "utf8",
    );
    expect(transportTypes).not.toContain("chat-state-store");
  });

  it("shell composer does not import chat-state-store legacy directly", () => {
    const composer = read("app/features/messaging/components/composer.tsx");
    expect(composer).not.toMatch(/chat-state-store-legacy/);
    expect(composer).not.toMatch(/features\/messaging\/services\/chat-state-store["']/);
  });

  it("w20: shell chat-view routes persisted history search through features port", () => {
    const chatView = read("app/features/messaging/components/chat-view.tsx");
    expect(chatView).not.toMatch(/chat-state-store-legacy/);
    expect(chatView).toContain("conversation-history-persisted-search-port");
    expect(chatView).toContain("searchConversationPersistedHistory");
  });

  it("w20: messaging provider routes UI chrome persistence through ui mirror", () => {
    const provider = read("app/features/messaging/providers/messaging-provider.tsx");
    expect(provider).not.toMatch(/chat-state-store-legacy/);
    expect(provider).toContain("messaging-chat-state-ui-mirror");
    expect(provider).toContain("messagingChatStateUiMirror");
  });
});
