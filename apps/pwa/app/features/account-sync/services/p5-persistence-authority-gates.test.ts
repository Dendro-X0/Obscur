import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = join(__dirname, "../../..");

const readSource = (relativePath: string): string => (
  readFileSync(join(APP_ROOT, relativePath), "utf8")
);

const listSourceFiles = (relativeDir: string, fileName: string): ReadonlyArray<string> => {
  const results: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry === fileName) {
        results.push(fullPath);
      }
    }
  };
  walk(join(APP_ROOT, relativeDir));
  return results;
};

describe("P5 persistence authority gates", () => {
  it("P5-BKP-1: native restore paths strip chat-state message bodies before replace", () => {
    const backupService = readSource("features/account-sync/services/encrypted-account-backup-service.ts");
    const materialization = readSource("features/account-sync/services/restore-materialization.ts");

    expect(backupService).toContain("stripChatStateMessageBodiesForNativeMirror");
    expect(materialization).toContain("stripChatStateMessageBodiesForNativeMirror");
    expect(backupService).toMatch(
      /isTauri\(\)\s*\?\s*stripChatStateMessageBodiesForNativeMirror[\s\S]*chatStateStoreService\.replace/,
    );
    expect(materialization).toMatch(
      /if \(isTauri\(\)\) \{[\s\S]*stripChatStateMessageBodiesForNativeMirror[\s\S]*chatStateStoreService\.replace/,
    );
  });

  it("ACC-04: call record sqlite owner is wired from call-state runtime", () => {
    const runtime = readSource("features/messaging/services/call-state-runtime.ts");
    const store = readSource("features/messaging/services/call-record-sqlite-store.ts");

    expect(store).toContain("dbInsertCallRecord");
    expect(store).toContain("dbGetCallRecords");
    expect(runtime).toContain("persistTerminalCallRecordFromStatus");
    expect(runtime).toMatch(/call-end[\s\S]*mirrorTerminalCallToSqlite/);
  });

  it("P5-DM-3: relay 7-day lookback constant is live-subscription only", () => {
    const hits = listSourceFiles("features/messaging", "dm-relay-transport.ts")
      .flatMap((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return source.includes("DM_SUBSCRIBE_HISTORY_LOOKBACK_SECONDS") ? [filePath] : [];
      });

    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain("dm-relay-transport.ts");

    const hydrateSources = [
      "features/messaging/services/dm-conversation-hydrate-indexed-scan.ts",
      "features/messaging/services/dm-conversation-hydrate-pipeline.ts",
      "features/messaging/services/dm-conversation-hydrate-read-model.ts",
    ];
    hydrateSources.forEach((relativePath) => {
      const source = readSource(relativePath);
      expect(source).not.toContain("DM_SUBSCRIBE_HISTORY_LOOKBACK_SECONDS");
      expect(source).not.toContain("86400 * 7");
    });
  });
});
