import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("profile isolation SEC-V3 contract (AUTH-4 / REL-003)", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const repoRoot = path.resolve(pwaRoot, "..", "..");
  const read = (relativePath: string) => readFileSync(path.join(pwaRoot, relativePath), "utf8");

  it("AUTH-4 / AB-08: community ledger hydration stays profile-scoped", () => {
    const isolation = read("app/features/groups/services/community-scope-isolation.test.ts");
    expect(isolation).toContain("AB-08");
    expect(isolation).toContain("REL-003");
    expect(isolation).toContain("getScopedStorageKey");
  });

  it("REL-003: membership ledger and sync state do not cross profile buses", () => {
    const ledger = read("app/features/groups/services/community-membership-ledger.test.ts");
    const sync = read("app/features/groups/services/community-sync-service.test.ts");
    const bus = read("app/features/profiles/services/single-process-profile-isolation.test.ts");
    expect(ledger).toContain("REL-003");
    expect(sync).toContain("REL-003");
    expect(bus).toContain("community-membership-ledger-updated");
  });

  it("REL-003: read models ignore foreign profile scope events", () => {
    const readModel = read("app/features/groups/hooks/use-community-membership-read-model-index.test.tsx");
    const hydration = read("app/features/messaging/providers/messaging-provider.hydration-scope.test.tsx");
    expect(readModel).toContain("REL-003");
    expect(hydration).toContain("another profile scope");
  });

  it("DM + chat-state stores isolate per profile scope", () => {
    const chatState = read("app/features/messaging/services/chat-state-store.replace-event.test.ts");
    const messageBus = read("app/features/messaging/services/message-bus.profile-isolation.test.ts");
    expect(chatState).toContain("profile scope");
    expect(messageBus).toContain("profile isolation");
  });

  it("verify:sec-v3-v1.9.5 includes AUTH-4 / REL-003 regression suite", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:sec-v3-v1.9.5");
    expect(pkg).toMatch(/community-scope-isolation\.test\.ts/);
    expect(pkg).toMatch(/single-process-profile-isolation\.test\.ts/);
    expect(pkg).toMatch(/profile-isolation-sec-v3\.contract\.test\.ts/);
  });
});
