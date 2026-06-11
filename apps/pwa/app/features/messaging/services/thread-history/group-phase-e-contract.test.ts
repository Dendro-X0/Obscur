import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { groupThreadHistoryAdapter } from "./group-adapter";
import { resolveThreadHistoryAdapter } from "./resolve-thread-history-adapter";

const APP_ROOT = join(__dirname, "../../../..");

const readSource = (relativePath: string): string => (
  readFileSync(join(APP_ROOT, relativePath), "utf8")
);

describe("Phase E — group thread history plug-in", () => {
  it("routes group kind to sqlite read adapter", () => {
    expect(resolveThreadHistoryAdapter("group")).toBe(groupThreadHistoryAdapter);
  });

  it("routes sealed commit through appendGroupThreadMessage", () => {
    const persistence = readSource("features/groups/services/sealed-group-message-persistence.ts");
    expect(persistence).toContain("appendGroupThreadMessage");
    expect(persistence).toContain("loadGroupThreadPageFromSqlite");
  });

  it("wires group display through useGroupThreadMessages", () => {
    const hook = readSource("features/messaging/hooks/use-thread-messages.ts");
    expect(hook).toContain("useGroupThreadMessages");
  });

  it("reads group history from dbGetGroupMessages rather than sealed-community state", () => {
    const store = readSource("features/messaging/services/thread-history/group-thread-sqlite-store.ts");
    const mainShell = readSource("features/main-shell/main-shell.tsx");
    expect(store).toContain("dbGetGroupMessages");
    expect(mainShell).not.toContain("mapSealedGroupMessagesToChatMessages");
  });

  it("wires relay ingest to appendGroupThreadMessage from shell surfaces", () => {
    const ingest = readSource("features/groups/services/group-thread-relay-ingest.ts");
    const mainShell = readSource("features/main-shell/main-shell.tsx");
    const groupHome = readSource("groups/[...id]/group-home-page-client.tsx");
    expect(ingest).toContain("ingestSealedCommunityRelayEvent");
    expect(ingest).toContain("appendGroupThreadMessage");
    expect(mainShell).toContain("useGroupThreadRelayIngest");
    expect(groupHome).toContain("useGroupThreadRelayIngest");
  });
});
