import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * U2 Wave C — no app callers of bare group-list IPC (`dbGetGroups` / `dbUpsertGroup`).
 * @see specs/backend/community-u2-group-persist-engine-design-2026-07.md
 */

const APP_ROOT = join(__dirname, "../../..");

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
const GROUP_LIST_BARE_IPC_ALLOWLIST = new Set<string>([]);

describe("workspace group persist owner (U2 Wave C)", () => {
  it("community-group-sqlite-store routes through workspace-group-persist-port", () => {
    const source = readFileSync(
      join(APP_ROOT, "features/groups/services/community-group-sqlite-store.ts"),
      "utf8",
    );
    expect(source).toContain("listWorkspaceGroupRecords");
    expect(source).toContain("upsertWorkspaceGroupRecord");
    expect(source).toContain("workspace-group-persist-port");
    expect(source).not.toMatch(/\bdbGetGroups\b/);
    expect(source).not.toMatch(/\bdbUpsertGroup\b/);
  });

  it("workspace-group-persist-port uses @obscur/workspace-engine", () => {
    const source = readFileSync(
      join(APP_ROOT, "features/groups/services/workspace-group-persist-port.ts"),
      "utf8",
    );
    expect(source).toContain("@obscur/workspace-engine");
    expect(source).toContain("listWorkspaceGroups");
    expect(source).toContain("upsertWorkspaceGroup");
    expect(source).not.toMatch(/\bdbGetGroups\b/);
    expect(source).not.toMatch(/\bdbUpsertGroup\b/);
  });

  it("production dbGetGroups / dbUpsertGroup call sites stay on empty allowlist", () => {
    const offenders = runtimeAppSources.filter((file) => {
      const rel = relative(APP_ROOT, file).replace(/\\/g, "/");
      if (GROUP_LIST_BARE_IPC_ALLOWLIST.has(rel)) {
        return false;
      }
      const source = readFileSync(file, "utf8");
      return /\bdbGetGroups\b/.test(source) || /\bdbUpsertGroup\b/.test(source);
    });
    expect(offenders.map((f) => relative(APP_ROOT, f).replace(/\\/g, "/"))).toEqual([]);
  });
});
