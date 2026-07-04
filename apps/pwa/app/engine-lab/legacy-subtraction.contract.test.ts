import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ENGINE_LAB_QUARANTINE_TARGETS,
  ENGINE_LAB_SUBTRACTED_FILES,
  OBSCUR_ENGINE_PACKAGE_ROOTS,
} from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");

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

const forbiddenPackageImportPatterns = [
  /from\s+["']@\/app\//,
  /from\s+["'][^"']*apps\/pwa/,
  /apps\/pwa\/app\//,
] as const;

describe("legacy subtraction B5 — engine package purity", () => {
  it("obscur engine packages have zero apps/pwa imports", () => {
    const offenders: string[] = [];
    for (const root of OBSCUR_ENGINE_PACKAGE_ROOTS) {
      const srcDir = join(REPO_ROOT, root, "src");
      if (!existsSync(srcDir)) continue;
      for (const file of collectTsFiles(srcDir)) {
        const source = readFileSync(file, "utf8");
        for (const pattern of forbiddenPackageImportPatterns) {
          if (pattern.test(source)) {
            offenders.push(`${relative(REPO_ROOT, file)} → ${pattern}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("legacy subtraction B5 — quarantine manifest", () => {
  it("B5 quarantine is empty when all targets subtracted", () => {
    expect(ENGINE_LAB_QUARANTINE_TARGETS).toEqual([]);
  });

  it("subtracted dead files stay deleted", () => {
    const resurrected: string[] = [];
    for (const rel of ENGINE_LAB_SUBTRACTED_FILES) {
      if (existsSync(join(REPO_ROOT, "apps/pwa", rel))) {
        resurrected.push(rel);
      }
    }
    expect(resurrected).toEqual([]);
  });

  it("QUARANTINE.md documents engine lab subtraction policy", () => {
    const source = readFileSync(join(REPO_ROOT, "apps/pwa/app/legacy/QUARANTINE.md"), "utf8");
    expect(source).toContain("ENGINE LAB");
    expect(source).toContain("dm-kernel");
    expect(source).toContain("transport-engine");
  });
});

describe("legacy subtraction B5 — verify script wired", () => {
  it("root package.json defines verify:legacy-subtraction", () => {
    const pkg = readFileSync(join(REPO_ROOT, "package.json"), "utf8");
    expect(pkg).toContain("verify:legacy-subtraction");
  });
});
