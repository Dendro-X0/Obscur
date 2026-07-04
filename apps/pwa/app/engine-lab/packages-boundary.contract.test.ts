import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PACKAGE_ROOTS = [
  join(REPO_ROOT, "packages/obscur-engine-contracts"),
  join(REPO_ROOT, "packages/obscur-engine-host"),
  join(REPO_ROOT, "packages/obscur-dm-engine"),
  join(REPO_ROOT, "packages/obscur-transport-engine"),
  join(REPO_ROOT, "packages/obscur-workspace-engine"),
  join(REPO_ROOT, "packages/obscur-auth-engine"),
  join(REPO_ROOT, "packages/obscur-conduit-mesh-contracts"),
  join(REPO_ROOT, "packages/obscur-conduit-mesh"),
] as const;

const collectTsFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      collectTsFiles(full, acc);
      continue;
    }
    if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

const forbiddenImportPatterns = [
  /from\s+["']@\/app\//,
  /from\s+["'][^"']*apps\/pwa/,
  /apps\/pwa\/app\//,
] as const;

describe("packages boundary — engine packages must not import apps/pwa", () => {
  it("obscur engine packages have no apps/pwa imports", () => {
    const offenders: string[] = [];
    for (const root of PACKAGE_ROOTS) {
      for (const file of collectTsFiles(join(root, "src"))) {
        const source = readFileSync(file, "utf8");
        for (const pattern of forbiddenImportPatterns) {
          if (pattern.test(source)) {
            offenders.push(`${relative(REPO_ROOT, file)} → ${pattern}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("dm-engine does not call db client invoke helpers", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/obscur-dm-engine/src/dm-engine.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/dbGetMessages/);
    expect(source).not.toMatch(/invoke\s*\(\s*["']db_/);
  });

  it("dm-engine repair does not import apps/pwa", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/obscur-dm-engine/src/dm-engine-repair.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/apps\/pwa/);
    expect(source).not.toMatch(/native-dm-sqlite-repair/);
  });
});
