import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 3.1 — K-SHELL-INVENT fence for the Vite lab tree.
 * desktop-ui must not invent a parallel PDK / SQLite opener or pull Next mega-providers.
 * @see specs/backend/cut3-ui-vite-thin-shell-design-2026-11-09.md
 */

const SRC_ROOT = join(fileURLToPath(new URL(".", import.meta.url)));

const FORBIDDEN_PATTERNS: ReadonlyArray<Readonly<{ id: string; re: RegExp }>> = [
  { id: "activateNativeStorageAtRestUnlock", re: /\bactivateNativeStorageAtRestUnlock\b/ },
  { id: "ensureNativeSqliteOpenForWrites", re: /\bensureNativeSqliteOpenForWrites\b/ },
  { id: "unlock_with_key invoke", re: /["']unlock_with_key["']/ },
  { id: "open_database invoke", re: /["']open_database["']/ },
  { id: "MessagingProvider import", re: /\bMessagingProvider\b/ },
  { id: "apps/pwa feature import", re: /from\s+["'][^"']*apps\/pwa\// },
  { id: "pwa @/app feature deep import", re: /from\s+["']@\/app\/features\// },
];

const collectSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") {
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

describe("Cut 3.1 desktop-ui no PDK invent", () => {
  it("forbids parallel PDK openers and Next mega-provider imports in src/", () => {
    const sources = collectSourceFiles(SRC_ROOT);
    expect(sources.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of sources) {
      const rel = relative(SRC_ROOT, file).replace(/\\/g, "/");
      const source = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.re.test(source)) {
          offenders.push(`${rel} · ${pattern.id}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
