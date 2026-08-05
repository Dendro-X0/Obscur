import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * R-SCOPE — production ambient profile-scope writers must stay allowlisted.
 * @see specs/backend/r-scope-slice2-design-2026-07.md
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

const OVERRIDE_ALLOWLIST = new Set([
  "features/profiles/services/profile-scope.ts",
  "features/profiles/services/desktop-profile-runtime.ts",
]);

const SYNC_INJECT_ALLOWLIST = new Set([
  "features/profiles/services/desktop-window-boot-payload.ts",
  "layout.tsx",
]);

describe("R-SCOPE profile-scope owner contracts", () => {
  it("setProfileScopeOverride production call sites stay on desktop-profile-runtime", () => {
    const offenders = runtimeAppSources.filter((file) => {
      const rel = relative(APP_ROOT, file).replace(/\\/g, "/");
      if (OVERRIDE_ALLOWLIST.has(rel)) {
        return false;
      }
      const source = readFileSync(file, "utf8");
      return /\bsetProfileScopeOverride\s*\(/.test(source);
    });
    expect(offenders.map((f) => relative(APP_ROOT, f).replace(/\\/g, "/"))).toEqual([]);
  });

  it("__OBSCUR_SYNC_PROFILE_SCOPE__ assignments stay on boot inject paths", () => {
    const offenders = runtimeAppSources.filter((file) => {
      const rel = relative(APP_ROOT, file).replace(/\\/g, "/");
      if (SYNC_INJECT_ALLOWLIST.has(rel)) {
        return false;
      }
      const source = readFileSync(file, "utf8");
      return /__OBSCUR_SYNC_PROFILE_SCOPE__\s*=/.test(source);
    });
    expect(offenders.map((f) => relative(APP_ROOT, f).replace(/\\/g, "/"))).toEqual([]);
  });
});
