import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("Cut 1.2 K-MSG-DUR owner-uniqueness", () => {
  it("MessageQueue gates every durable I/O path behind nativeDmSkipsIndexedDbMessageQueue", () => {
    const source = read("app/features/messaging/lib/message-queue.ts");
    for (const method of [
      "persistMessage",
      "getMessage",
      "getMessages",
      "queueOutgoingMessage",
      "getQueuedMessages",
      "deleteMessage",
      "removeFromQueue",
      "getAllMessages",
    ] as const) {
      expect(source).toMatch(
        new RegExp(`async ${method}[\\s\\S]*?nativeDmSkipsIndexedDbMessageQueue\\(\\)`),
      );
    }
    expect(source).toMatch(
      /getDb\(\)[\s\S]*?nativeDmSkipsIndexedDbMessageQueue\(\)[\s\S]*?throw new Error/,
    );
  });

  it("openMessageDb refuses when requiresSqlitePersistence", () => {
    const source = read("app/features/messaging/lib/open-message-db.ts");
    expect(source).toContain("requiresSqlitePersistence()");
    expect(source).toContain("Cut 1.2");
    expect(source).toMatch(/if \(requiresSqlitePersistence\(\)\) \{[\s\S]*?Promise\.reject/);
  });

  it("restore hydrate skips message IDB / MessageQueue on native", () => {
    const source = read("app/features/account-sync/services/restore-hydrate-indexed-messages.ts");
    expect(source).toContain("nativeDmSkipsIndexedDbMessageQueue");
    expect(source).toMatch(
      /loadMessageQueueRecords[\s\S]*?nativeDmSkipsIndexedDbMessageQueue\(\)[\s\S]*?return \[\]/,
    );
    expect(source).toMatch(
      /loadIndexedMessageRecords[\s\S]*?requiresSqlitePersistence\(\)[\s\S]*?return \[\]/,
    );
  });

  it("local history reset does not openMessageDb on native", () => {
    const source = read("app/features/messaging/services/local-history-reset-service.ts");
    expect(source).toMatch(
      /clearLegacyMessageQueueStores[\s\S]*?requiresSqlitePersistence\(\)[\s\S]*?return 0/,
    );
  });
});

describe("Cut 1.2 openMessageDb runtime refuse under sqlite persistence", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/app/features/runtime/native-persistence-policy", () => ({
      requiresSqlitePersistence: () => true,
    }));
  });

  afterEach(() => {
    vi.doUnmock("@/app/features/runtime/native-persistence-policy");
    vi.resetModules();
  });

  it("rejects openMessageDb when native SQLite persistence is required", async () => {
    const { openMessageDb } = await import("../lib/open-message-db");
    await expect(openMessageDb()).rejects.toThrow(/Cut 1\.2/);
  });
});
