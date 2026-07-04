import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = join(__dirname, "../../../..");

const readSource = (relativePath: string): string => (
  readFileSync(join(APP_ROOT, relativePath), "utf8")
);

describe("Phase D — DM durability contract", () => {
  it("awaits native SQLite inserts before flush completes", () => {
    const source = readSource("features/messaging/services/message-persistence-service.ts");
    expect(source).toContain("await Promise.all(sqliteWritePromises)");
    expect(source).not.toMatch(/dbInsertMessage\(rec\)\.catch\(\(\) => \{\}\)/);
  });

  it("skips live chat-state message body mirror on native SQLite authority", () => {
    const source = readSource("features/messaging/services/message-persistence-service.ts");
    expect(source).toMatch(
      /mirrorMessageToChatState[\s\S]*requiresSqlitePersistence\(\)[\s\S]*return;/,
    );
  });

  it("links local media index entries to message event_id after persist", () => {
    const persistence = readSource("features/messaging/services/message-persistence-service.ts");
    const mediaStore = readSource("features/vault/services/local-media-store.ts");
    expect(persistence).toContain("linkLocalMediaIndexToMessageEvent");
    expect(mediaStore).toContain("messageEventId");
  });

  it("uses checkpoint-driven relay repair separate from hydrate read path", () => {
    const orchestrator = readSource("features/messaging/controllers/dm-sync-orchestrator.ts");
    const hydrate = readSource("features/messaging/services/thread-history/hydrate-indexed-scan.ts");
    expect(orchestrator).toContain("repairTimelineCheckpoint");
    expect(orchestrator).toContain("createBackfillRequest");
    expect(hydrate).not.toContain("DM_SUBSCRIBE_HISTORY_LOOKBACK_SECONDS");
  });

  it("wires MessagePersistenceDurabilityOwner on app shell", () => {
    const providers = readSource("components/providers.tsx");
    expect(providers).toContain("MessagePersistenceDurabilityOwner");
  });

  it("uses sqlite-only native DM thread read owner (R1 subtraction)", () => {
    const policy = readSource("features/messaging/services/native-dm-read-policy.ts");
    const authority = readSource("features/messaging/services/dm-read-authority-contract.ts");
    const hook = readSource("features/messaging/hooks/use-conversation-messages-legacy.ts");
    const readModel = readSource("features/messaging/services/thread-history/hydrate-read-model.ts");
    const messageQueue = readSource("features/messaging/lib/message-queue.ts");
    expect(policy).toContain("isNativeDmSqliteReadOwner");
    expect(policy).toContain("nativeDmSkipsIndexedDbMessageQueue");
    expect(authority).toContain("if (isNativeDmSqliteReadOwner())");
    expect(hook).toContain("isNativeDmSqliteReadOwner()");
    expect(readModel).toContain("!isNativeDmSqliteReadOwner()");
    expect(messageQueue).toContain("nativeDmSkipsIndexedDbMessageQueue()");
  });

  it("flushes native sqlite writes immediately on each bus upsert", () => {
    const source = readSource("features/messaging/services/message-persistence-service.ts");
    expect(source).toMatch(/if \(isTauri\(\)\) \{[\s\S]*void this\.flushPendingNow\(\)/);
  });

  it("v2 dm-controller wires relay sync backfill (not a TODO stub)", () => {
    const controller = readSource("features/messaging/controllers/v2/dm-controller.ts");
    expect(controller).toMatch(/from\s+["']\.\.\/dm-sync-orchestrator["']/);
    expect(controller).toContain("syncMissedMessages as syncMissedMessagesImpl");
    expect(controller).toContain("await syncMissedMessagesImpl({");
    expect(controller).not.toMatch(/syncMissedMessages[\s\S]{0,120}\/\/ TODO: implement sync/);
  });

  it("v2 dm-controller schedules cold-start sync when relays open", () => {
    const controller = readSource("features/messaging/controllers/v2/dm-controller.ts");
    expect(controller).toContain("hasTriggeredInitialSyncRef");
    expect(controller).toContain("initialSyncTimeoutRef");
    expect(controller).toMatch(/void syncMissedMessages\(\)/);
  });

  it("runtime transport owner passes transportOwnerId into v2 controller", () => {
    const provider = readSource("features/messaging/providers/runtime-messaging-transport-owner-provider.tsx");
    expect(provider).toContain("transportOwnerId:");
    expect(provider).toMatch(/useDmController\(\{[\s\S]*transportOwnerId/);
  });

  it("native hydrate finalize surfaces sqlite truth without merge guards", () => {
    const readModel = readSource("features/messaging/services/dm-thread-read-model.ts");
    expect(readModel).toMatch(/if \(isNativeDmSqliteReadOwner\(\)\) \{[\s\S]*hydratedMessages: params\.assembledMessages/);
    expect(readModel).toContain("shouldRetryHydrate: false");
  });

  it("native sqlite repair owner requests relay backfill (not projection merge)", () => {
    const repair = readSource("features/messaging/services/native-dm-sqlite-repair.ts");
    const integrity = readSource("features/messaging/services/native-dm-sqlite-integrity.ts");
    const provider = readSource("features/messaging/providers/runtime-messaging-transport-owner-provider.tsx");
    expect(repair).toContain("scanNativeDmOneSidedConversations");
    expect(repair).toContain("requestNativeDmRelayBackfillRepair");
    expect(repair).toContain("NATIVE_DM_SQLITE_RELAY_BACKFILL_REPAIR_EVENT");
    expect(integrity).toContain("maybeScheduleNativeDmRelayBackfillRepair");
    expect(provider).toContain("subscribeNativeDmRelayBackfillRepair");
    expect(provider).toContain("syncMissedMessagesRef.current");
  });

  it("dev-lab exposes native relay backfill repair entrypoints", () => {
    const install = readSource("features/dev-lab/dev-lab-install.ts");
    const bridge = readSource("features/dev-lab/dev-lab-messaging-bridge.tsx");
    expect(install).toContain("forceNativeDmRelayBackfillSync");
    expect(bridge).toContain("skipCooldown: true");
  });
});
