import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_APP_ROOT = join(REPO_ROOT, "apps/pwa/app");

/**
 * w26 — port-only importer graph for remaining `app/legacy/*`.
 * After w40 the deletion queue is empty and `app/legacy/` holds docs only.
 */
const LEGACY_DELETION_QUEUE: ReadonlyArray<{ legacy: string }> = [];

const LEGACY_BASENAMES = LEGACY_DELETION_QUEUE.map((entry) => entry.legacy.replace(/\.tsx?$/, ""));

const isLegacyPortFile = (relativePath: string): boolean => (
  /-port\.(ts|tsx)$/.test(relativePath)
  || relativePath.endsWith("messaging-chat-state-ui-mirror.ts")
);

const collectAppSources = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "legacy") {
        continue;
      }
      collectAppSources(full, acc);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.(ts|tsx)$/.test(entry)) {
      continue;
    }
    acc.push(full);
  }
  return acc;
};

describe("legacy subtraction w26 — port-only deletion queue", () => {
  it("legacy deletion queue is empty after w40", () => {
    expect(LEGACY_DELETION_QUEUE.length).toBe(0);
  });

  it("app/legacy has no implementation sources", () => {
    const legacyDir = join(PWA_APP_ROOT, "legacy");
    const implementationFiles = readdirSync(legacyDir).filter((entry) => /\.tsx?$/.test(entry));
    expect(implementationFiles).toEqual([]);
  });

  it("app production sources do not import app/legacy", () => {
    const offenders: string[] = [];
    for (const file of collectAppSources(PWA_APP_ROOT)) {
      const rel = relative(PWA_APP_ROOT, file).replace(/\\/g, "/");
      if (isLegacyPortFile(rel)) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      if (!source.includes("@/app/legacy/")) {
        continue;
      }
      offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("no production source references queued legacy basenames outside ports", () => {
    const offenders: string[] = [];
    for (const file of collectAppSources(PWA_APP_ROOT)) {
      const rel = relative(PWA_APP_ROOT, file).replace(/\\/g, "/");
      if (isLegacyPortFile(rel)) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      for (const basename of LEGACY_BASENAMES) {
        if (source.includes(basename)) {
          offenders.push(`${rel} → ${basename}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
