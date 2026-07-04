#!/usr/bin/env node
/**
 * B5 legacy subtraction gate — obscur package purity + subtracted file tombstones.
 * Tombstone list is parsed from apps/pwa/app/engine-lab/legacy-subtraction-manifest.ts (single source).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = join(repoRoot, "apps/pwa/app/engine-lab/legacy-subtraction-manifest.ts");

const forbiddenPackageImportPatterns = [
  /from\s+["']@\/app\//,
  /from\s+["'][^"']*apps\/pwa/,
  /apps\/pwa\/app\//,
];

const parseManifestStringArray = (source, exportName) => {
  const block = source.match(new RegExp(`export const ${exportName} = \\[([\\s\\S]*?)\\] as const`));
  if (!block) {
    throw new Error(`verify-legacy-subtraction: failed to parse ${exportName} from manifest`);
  }
  return [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
};

const loadManifest = () => {
  const source = readFileSync(manifestPath, "utf8");
  return {
    quarantineTargets: parseManifestStringArray(source, "ENGINE_LAB_QUARANTINE_TARGETS"),
    subtractedFiles: parseManifestStringArray(source, "ENGINE_LAB_SUBTRACTED_FILES"),
    packageRoots: parseManifestStringArray(source, "OBSCUR_ENGINE_PACKAGE_ROOTS"),
  };
};

const collectTsFiles = (dir, acc = []) => {
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

const assertPackagePurity = (packageRoots) => {
  const offenders = [];
  for (const root of packageRoots) {
    const srcDir = join(repoRoot, root, "src");
    if (!existsSync(srcDir)) continue;
    for (const file of collectTsFiles(srcDir)) {
      const source = readFileSync(file, "utf8");
      for (const pattern of forbiddenPackageImportPatterns) {
        if (pattern.test(source)) {
          offenders.push(`${relative(repoRoot, file)} → ${pattern}`);
        }
      }
    }
  }
  if (offenders.length > 0) {
    throw new Error(`obscur engine packages import apps/pwa:\n${offenders.join("\n")}`);
  }
};

const assertSubtractedFilesGone = (subtractedFiles) => {
  const resurrected = subtractedFiles.filter((rel) => (
    existsSync(join(repoRoot, "apps/pwa", rel))
  ));
  if (resurrected.length > 0) {
    throw new Error(`B5 subtracted files resurrected:\n${resurrected.map((rel) => `apps/pwa/${rel}`).join("\n")}`);
  }
};

const manifest = loadManifest();
assertPackagePurity(manifest.packageRoots);
assertSubtractedFilesGone(manifest.subtractedFiles);
console.log(`verify-legacy-subtraction: ok (${manifest.subtractedFiles.length} tombstones, ${manifest.quarantineTargets.length} quarantine)`);
