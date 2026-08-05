import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * R1 Wave 4 — refuse tombstone deleted; ThreadHistoryPort types kept for group adapters.
 * @see specs/backend/r1-wave4-refuse-tombstone-design-2026-07.md
 */

const APP_ROOT = join(__dirname, "../../..");

const readApp = (relativePath: string): string => (
  readFileSync(join(APP_ROOT, relativePath), "utf8")
);

const DELETED = [
  "features/messaging/services/native-dm-conversation-hydrate-owner.ts",
  "features/messaging/services/native-dm-conversation-hydrate-port.ts",
  "features/messaging/services/native-dm-conversation-hydrate-owner.test.ts",
] as const;

const KEPT = [
  "features/messaging/services/thread-history/port.ts",
  "features/messaging/services/thread-history/hydrate-read-model-types.ts",
  "features/messaging/services/thread-history/group-adapter.ts",
] as const;

describe("r1 wave4 refuse tombstone deletion", () => {
  it("native DM hydrate refuse owner and port are gone", () => {
    for (const rel of DELETED) {
      expect(existsSync(join(APP_ROOT, rel)), rel).toBe(false);
    }
  });

  it("ThreadHistoryPort and group adapter types remain", () => {
    for (const rel of KEPT) {
      expect(existsSync(join(APP_ROOT, rel)), rel).toBe(true);
    }
    const port = readApp("features/messaging/services/thread-history/port.ts");
    expect(port).toContain("export type ThreadHistoryPort");
    expect(port).not.toContain("DmConversationMaterializationPort");
  });

  it("messaging-client-operations uses ThreadHistoryPort only", () => {
    const ops = readApp("features/messaging/services/messaging-client-operations.ts");
    expect(ops).toContain("ThreadHistoryPort");
    expect(ops).not.toContain("DmConversationMaterializationPort");
  });
});
