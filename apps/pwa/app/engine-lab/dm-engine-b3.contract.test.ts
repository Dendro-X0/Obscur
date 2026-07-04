import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const DM_KERNEL_DIR = join(REPO_ROOT, "apps/pwa/app/features/dm-kernel");

const collectTsFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectTsFiles(full, acc);
      continue;
    }
    if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

describe("dm-engine b3 — persistence hardening", () => {
  it("dm-kernel ports do not import chat-state-store", () => {
    const offenders: string[] = [];
    for (const file of collectTsFiles(DM_KERNEL_DIR)) {
      const source = readFileSync(file, "utf8");
      if (/chat-state-store/.test(source)) {
        offenders.push(relative(REPO_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("repair policy lives in @obscur/dm-engine", () => {
    const repair = readFileSync(
      join(REPO_ROOT, "packages/obscur-dm-engine/src/dm-engine-repair.ts"),
      "utf8",
    );
    expect(repair).toContain("requestDmRelayBackfill");
    expect(repair).not.toMatch(/native-dm-sqlite-repair/);
    expect(repair).not.toMatch(/apps\/pwa/);
  });

  it("dm-kernel repair delegates to dm-engine package", () => {
    const source = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/dm-kernel/dm-kernel-repair.ts"),
      "utf8",
    );
    expect(source).toContain("requestDmRelayBackfill");
    expect(source).toContain("@obscur/dm-engine");
  });

  it("thread and sidebar ports route strict reads through dm-engine", () => {
    const thread = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/dm-kernel/dm-kernel-thread-port.ts"),
      "utf8",
    );
    const sidebar = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/dm-kernel/dm-kernel-sidebar-port.ts"),
      "utf8",
    );
    expect(thread).toContain("fetchDmThreadRows");
    expect(sidebar).toContain("listDmConversations");
    expect(thread).toContain("isEngineLabStrictMode");
    expect(sidebar).toContain("isEngineLabStrictMode");
  });

  it("libobscur defines dm read page budget test", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/libobscur/src/db/repositories/messages.rs"),
      "utf8",
    );
    expect(source).toContain("test_dm_read_path_page_budget");
  });
});
