import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * dm-persist — clarify heuristic dual-owner + flush dedupe.
 * @see specs/backend/dm-persist-dual-owner-design-2026-07.md
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

/** U1 Done — no product caller of bare dbInsertMessage. */
const DB_INSERT_MESSAGE_ALLOWLIST = new Set<string>([]);

describe("dm-persist owner contracts", () => {
  it("MessagePersistenceDurabilityOwner stays mounted on app shell", () => {
    const providers = readFileSync(join(APP_ROOT, "components/providers.tsx"), "utf8");
    expect(providers).toContain("MessagePersistenceDurabilityOwner");
  });

  it("MessagePersistenceService does not dual-register hide/unload flush listeners", () => {
    const source = readFileSync(
      join(APP_ROOT, "features/messaging/services/message-persistence-service.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/addEventListener\s*\(\s*["']beforeunload["']/);
    expect(source).not.toMatch(/addEventListener\s*\(\s*["']visibilitychange["']/);
    expect(source).not.toMatch(/addEventListener\s*\(\s*["']pagehide["']/);
  });

  it("durability owner owns pagehide / beforeunload / visibility flush", () => {
    const source = readFileSync(
      join(APP_ROOT, "features/messaging/components/message-persistence-durability-owner.tsx"),
      "utf8",
    );
    expect(source).toContain('addEventListener("pagehide"');
    expect(source).toContain('addEventListener("beforeunload"');
    expect(source).toContain('addEventListener("visibilitychange"');
    expect(source).toContain("flushPendingNow");
  });

  it("MessagePersistenceService routes Tauri inserts only through dm-kernel write port", () => {
    const source = readFileSync(
      join(APP_ROOT, "features/messaging/services/message-persistence-service.ts"),
      "utf8",
    );
    expect(source).toContain("writeDmKernelMessage");
    expect(source).toContain("writeDmKernelConversation");
    expect(source).not.toMatch(/\bdbInsertMessage\s*\(/);
    expect(source).not.toMatch(/\bdbUpsertConversation\s*\(/);
  });

  it("community invite pipeline routes native persist through dm-kernel write port", () => {
    const source = readFileSync(
      join(APP_ROOT, "features/groups/services/community-dm-invite-pipeline.ts"),
      "utf8",
    );
    expect(source).toContain("writeDmKernelMessage");
    expect(source).toContain("writeDmKernelConversation");
    expect(source).not.toMatch(/\bdbInsertMessage\s*\(/);
    expect(source).not.toMatch(/\bdbUpsertConversation\s*\(/);
  });

  it("production dbInsertMessage call sites stay on allowlist", () => {
    const offenders = runtimeAppSources.filter((file) => {
      const rel = relative(APP_ROOT, file).replace(/\\/g, "/");
      if (DB_INSERT_MESSAGE_ALLOWLIST.has(rel)) {
        return false;
      }
      const source = readFileSync(file, "utf8");
      return /\bdbInsertMessage\s*\(/.test(source);
    });
    expect(offenders.map((f) => relative(APP_ROOT, f).replace(/\\/g, "/"))).toEqual([]);
  });
});
