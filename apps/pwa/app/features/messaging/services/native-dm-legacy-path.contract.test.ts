import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const APP_ROOT = join(__dirname, "../../..");
const REPO_SCRIPTS_ROOT = join(APP_ROOT, "../../../scripts");

const readSource = (relativePath: string): string => (
  readFileSync(join(APP_ROOT, relativePath), "utf8")
);

const collectSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "__tests__") {
        continue;
      }
      collectSourceFiles(full, acc);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

const runtimeAppSources = collectSourceFiles(APP_ROOT).filter((file) => {
  const rel = relative(APP_ROOT, file).replace(/\\/g, "/");
  if (rel.includes("features/messaging/lib/__tests__/")) {
    return false;
  }
  if (rel.startsWith("tests/")) {
    return false;
  }
  return true;
});

describe("native DM legacy path subtraction contracts", () => {
  it("production app code does not import controllers/legacy/enhanced-dm-controller.ts", () => {
    const offenders = runtimeAppSources.filter((file) => {
      const source = readFileSync(file, "utf8");
      return /from\s+["'][^"']*controllers\/legacy\/enhanced-dm-controller["']/.test(source)
        || /from\s+["'][^"']*controllers\/enhanced-dm-controller["']/.test(source);
    });
    expect(offenders.map((f) => relative(APP_ROOT, f))).toEqual([]);
  });

  it("production app code does not import controllers/legacy/incoming-dm-event-handler.ts", () => {
    const offenders = runtimeAppSources.filter((file) => {
      const source = readFileSync(file, "utf8");
      return /from\s+["'][^"']*controllers\/legacy\/incoming-dm-event-handler["']/.test(source)
        || /from\s+["'][^"']*controllers\/incoming-dm-event-handler["']/.test(source);
    });
    expect(offenders.map((f) => relative(APP_ROOT, f))).toEqual([]);
  });

  it("production app code does not import v1 outgoing-dm stack", () => {
    const forbidden = [
      "controllers/outgoing-dm-orchestrator",
      "controllers/outgoing-dm-publisher",
      "controllers/outgoing-dm-send-preparer",
      "controllers/relay-ok-message-handler",
      "controllers/recipient-discovery-service",
      "controllers/dm-queue-orchestrator",
    ];
    const offenders = runtimeAppSources.filter((file) => {
      const source = readFileSync(file, "utf8");
      return forbidden.some((fragment) => (
        new RegExp(`from\\s+["'][^"']*${fragment.replace(/\//g, "\\/")}["']`).test(source)
      ));
    });
    expect(offenders.map((f) => relative(APP_ROOT, f))).toEqual([]);
  });

  it("use-enhanced-dm-controller hook re-exports v2 dm-controller only", () => {
    const source = readSource("features/messaging/hooks/use-enhanced-dm-controller.ts");
    expect(source).toMatch(/from\s+["']\.\.\/controllers\/v2\/dm-controller["']/);
    expect(source).not.toMatch(/from\s+["'][^"']*controllers\/(legacy\/)?enhanced-dm-controller["']/);
  });

  it("dm-native-persist scenario reads SQLite on native when available", () => {
    const scenario = readFileSync(
      join(REPO_SCRIPTS_ROOT, "lib/dev-lab-dm-native-persist.mjs"),
      "utf8",
    );
    expect(scenario).toContain("getSqliteMessagesForPeer");
  });

  it("native-dm-thread-hydrate does not import interim hydrate authority stack", () => {
    const source = readSource("features/messaging/services/thread-history/native-dm-thread-hydrate.ts");
    const forbidden = [
      "dm-read-authority-contract",
      "dm-conversation-hydrate-read-model",
      "dm-conversation-hydrate-pipeline",
      "dm-conversation-projection-live-merge",
      "dm-conversation-projection-evidence-messages",
    ];
    const importLines = source
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line));
    forbidden.forEach((fragment) => {
      const offender = importLines.find((line) => line.includes(fragment));
      expect(offender, `forbidden import: ${fragment}`).toBeUndefined();
    });
  });

  it("resolve-dm-thread-history-adapter routes native sqlite owner through dm-kernel stub", () => {
    const source = readSource("features/messaging/services/thread-history/resolve-dm-thread-history-adapter.ts");
    expect(source).toContain("dmKernelThreadHistoryStub");
    expect(source).toContain("isDmKernelAuthority");
    expect(source).toContain("isObscurAllowLegacy");
    expect(source).not.toMatch(/from\s+["']\.\/native-dm-adapter["']/);
  });

  it("use-conversation-messages delegates native hydrate to native-dm-conversation-hydrate-owner", () => {
    const source = readSource("features/messaging/hooks/use-conversation-messages-legacy.ts");
    expect(source).toContain("runLegacyNativeDmConversationHistoryHydrate");
    expect(source).toContain("shouldNativeDmSkipHydrateRetryTrigger");
  });

  it("messaging-provider uses native sqlite sidebar list owner on desktop", () => {
    const source = readSource("features/messaging/providers/messaging-provider.tsx");
    expect(source).toContain("resolveNativeDmSidebarConnections");
    expect(source).toContain("shouldNativeDmSkipChatStateSidebarConnectionHydrate");
    expect(source).toContain("isNativeDmConversationListSqliteOwner");
    expect(source).toMatch(
      /shouldNativeDmSkipChatStateSidebarConnectionHydrate\(\)\s*\)\s*\{[\s\S]*const nextCreatedConnections = buildDmConnectionsFromPersistedChatState/,
    );
  });

  it("dm-native-relay-backfill scenario forces relay sync repair on native CDP", () => {
    const scenario = readFileSync(
      join(REPO_SCRIPTS_ROOT, "lib/dev-lab-dm-native-relay-backfill.mjs"),
      "utf8",
    );
    expect(scenario).toContain("forceNativeDmRelayBackfillSync");
    expect(scenario).toContain("messaging.transport.sync_start");
    expect(scenario).toContain("sqlite_bidirectional_after_repair");
    expect(scenario).toContain("two_actor_inbound_seed");
    expect(scenario).toContain("native_sqlite_write_probe");
    expect(scenario).toContain("triggerMissedMessageSync");
  });
});
