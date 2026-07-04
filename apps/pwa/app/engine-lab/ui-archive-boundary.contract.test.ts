import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const UI_KIT_SRC = join(REPO_ROOT, "packages/ui-kit/src");

const collectTsFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      collectTsFiles(full, acc);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

describe("ui archive boundary", () => {
  it("ui-kit does not import from apps/pwa or feature internals", () => {
    const files = collectTsFiles(UI_KIT_SRC);
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (/from\s+["']@\/app\//.test(source)) {
        offenders.push(relative(REPO_ROOT, file));
      }
      if (/apps\/pwa/.test(source)) {
        offenders.push(relative(REPO_ROOT, file));
      }
      if (/features\/(messaging|relays|groups|auth)\//.test(source)) {
        offenders.push(relative(REPO_ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("ui archive manifest exists", () => {
    const manifest = readFileSync(
      join(REPO_ROOT, "docs/program/obscur-ui-archive-manifest.md"),
      "utf8",
    );
    expect(manifest).toContain("packages/ui-kit");
    expect(manifest).toContain("apps/pwa");
  });

  it("backend engine roadmap exists", () => {
    const roadmap = readFileSync(
      join(REPO_ROOT, "docs/program/obscur-backend-engine-roadmap.md"),
      "utf8",
    );
    expect(roadmap).toMatch(/Integration|Fault tolerance|Performance|Maintainability/);
  });
});
