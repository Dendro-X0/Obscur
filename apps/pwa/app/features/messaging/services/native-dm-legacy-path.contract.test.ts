import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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

  it("native-dm-thread-hydrate implementation is deleted (Wave 3)", () => {
    expect(existsSync(join(APP_ROOT, "features/messaging/services/thread-history/native-dm-thread-hydrate.ts"))).toBe(false);
    expect(existsSync(join(APP_ROOT, "features/messaging/services/thread-history/native-dm-adapter.ts"))).toBe(false);
  });

  it("resolve-dm-thread-history-adapter always returns dm-kernel stub (Wave 2)", () => {
    const source = readSource("features/messaging/services/thread-history/resolve-dm-thread-history-adapter.ts");
    expect(source).toContain("dmKernelThreadHistoryStub");
    expect(source).not.toContain("isObscurAllowLegacy");
    expect(source).not.toContain("require(");
    expect(source).not.toMatch(/from\s+["']\.\/native-dm-adapter["']/);
    expect(source).not.toMatch(/from\s+["']\.\/dm-adapter["']/);
  });

  it("legacy UI hydrate hook and native refuse owner are deleted (Wave 4)", () => {
    expect(existsSync(join(APP_ROOT, "features/messaging/hooks/use-conversation-messages-legacy.ts"))).toBe(false);
    expect(existsSync(join(APP_ROOT, "features/messaging/services/native-dm-conversation-hydrate-owner.ts"))).toBe(false);
    expect(existsSync(join(APP_ROOT, "features/messaging/services/native-dm-conversation-hydrate-port.ts"))).toBe(false);
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

  it("product transport owner remains the native relay backfill repair surface", () => {
    const provider = readSource("features/messaging/providers/runtime-messaging-transport-owner-provider.tsx");
    expect(provider).toContain("subscribeNativeDmRelayBackfillRepair");
    expect(provider).toContain("syncMissedMessagesRef.current");
  });
});
