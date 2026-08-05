import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * U2 Wave C — no app callers of bare group-message IPC.
 * @see specs/backend/community-u2-group-persist-engine-design-2026-07.md
 */

const APP_ROOT = join(__dirname, "../../../..");

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
    if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry) && !/\.contract\.test\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

const runtimeAppSources = collectSourceFiles(APP_ROOT).filter((file) => {
  const rel = relative(APP_ROOT, file).replace(/\\/g, "/");
  return !rel.startsWith("tests/");
});

/** Wave C — empty. */
const GROUP_MESSAGE_BARE_IPC_ALLOWLIST = new Set<string>([]);

describe("workspace group message persist owner (U2 Wave C)", () => {
  it("append / sqlite / suppress route through workspace-group-message-persist-port", () => {
    const append = readFileSync(
      join(APP_ROOT, "features/messaging/services/thread-history/group-thread-append.ts"),
      "utf8",
    );
    const store = readFileSync(
      join(APP_ROOT, "features/messaging/services/thread-history/group-thread-sqlite-store.ts"),
      "utf8",
    );
    const suppress = readFileSync(
      join(APP_ROOT, "features/messaging/services/thread-history/group-thread-suppress.ts"),
      "utf8",
    );
    expect(append).toContain("insertWorkspaceGroupMessageRecord");
    expect(store).toContain("listWorkspaceGroupMessageRecords");
    expect(suppress).toContain("insertWorkspaceGroupTombstoneRecord");
    expect(append).not.toMatch(/\bdbInsertGroupMessage\b/);
    expect(store).not.toMatch(/\bdbGetGroupMessages\b/);
    expect(suppress).not.toMatch(/\bdbInsertGroupTombstone\b/);
  });

  it("workspace-group-message-persist-port uses @obscur/workspace-engine", () => {
    const source = readFileSync(
      join(APP_ROOT, "features/messaging/services/thread-history/workspace-group-message-persist-port.ts"),
      "utf8",
    );
    expect(source).toContain("@obscur/workspace-engine");
    expect(source).toContain("listWorkspaceGroupMessages");
    expect(source).toContain("insertWorkspaceGroupMessage");
    expect(source).toContain("insertWorkspaceGroupTombstone");
  });

  it("production group-message bare IPC call sites stay on empty allowlist", () => {
    const offenders = runtimeAppSources.filter((file) => {
      const rel = relative(APP_ROOT, file).replace(/\\/g, "/");
      if (GROUP_MESSAGE_BARE_IPC_ALLOWLIST.has(rel)) {
        return false;
      }
      const source = readFileSync(file, "utf8");
      return (
        /\bdbInsertGroupMessage\b/.test(source)
        || /\bdbGetGroupMessages\b/.test(source)
        || /\bdbInsertGroupTombstone\b/.test(source)
      );
    });
    expect(offenders.map((f) => relative(APP_ROOT, f).replace(/\\/g, "/"))).toEqual([]);
  });
});
