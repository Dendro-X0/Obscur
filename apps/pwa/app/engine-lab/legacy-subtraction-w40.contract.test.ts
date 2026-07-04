import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

const CHAT_STATE_PORTS = [
  "app/features/account-sync/services/account-sync-chat-state-port.ts",
  "app/features/messaging/services/messaging-chat-state-durability-port.ts",
  "app/features/messaging/services/messaging-chat-state-message-port.ts",
  "app/features/messaging/services/messaging-chat-state-read-port.ts",
  "app/features/messaging/services/conversation-history-persisted-search-port.ts",
  "app/features/messaging/services/messaging-chat-state-ui-mirror.ts",
] as const;

const FEATURES_CHAT_STATE_LEGACY_IMPORT = /chat-state-store-legacy/;

describe("legacy subtraction w40 — chat-state-store deleted from legacy", () => {
  it("chat-state-store legacy file is tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/chat-state-store-legacy.ts",
    );
  });

  it("chat-state-store legacy file stays deleted from app/legacy", () => {
    expect(existsSync(join(PWA_ROOT, "app/legacy/chat-state-store-legacy.ts"))).toBe(false);
  });

  it("canonical chat-state store lives in features without app/legacy imports", () => {
    const source = read("app/features/messaging/services/chat-state-store-legacy.ts");
    expect(source).toContain("chatStateStoreService");
    expect(source).not.toMatch(/@\/app\/legacy\//);
  });

  it("chat-state ports import features implementation only", () => {
    for (const portPath of CHAT_STATE_PORTS) {
      const port = read(portPath);
      expect(port, portPath).toMatch(FEATURES_CHAT_STATE_LEGACY_IMPORT);
      expect(port, portPath).not.toMatch(/@\/app\/legacy\//);
    }
  });

  it("app/legacy has no TypeScript implementation sources after w40", () => {
    const legacyDir = join(PWA_ROOT, "app/legacy");
    const implementationFiles = readdirSync(legacyDir).filter((entry) => /\.tsx?$/.test(entry));
    expect(implementationFiles).toEqual([]);
  });
});
