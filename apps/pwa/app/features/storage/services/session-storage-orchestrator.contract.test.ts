import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Cut 0.3 — PDK open / SQLite ensure stay on unlock faces + orchestrator.
 * Feature modules must use `rebindNativeSqliteIfSessionOpen` / probe only.
 * @see specs/backend/cut0-account-spine-design-2026-11-09.md slice 0.3
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

const ACTIVATE_ALLOWLIST = new Set([
  "features/storage/services/native-storage-at-rest-service.ts",
  "features/storage/services/session-storage-orchestrator.ts",
  "features/auth/services/complete-device-password-bind-after-key.ts",
  "features/auth/hooks/use-identity.ts",
  "features/auth/components/auth-screen.tsx",
  "features/security/components/vault-write-unlock-dialog.tsx",
]);

const ENSURE_ALLOWLIST = new Set([
  "features/storage/services/native-storage-at-rest-service.ts",
  "features/storage/services/session-storage-orchestrator.ts",
  "features/auth/services/complete-device-password-bind-after-key.ts",
  "features/auth/components/auth-screen.tsx",
]);

describe("Cut 0.3 session storage orchestrator contracts", () => {
  it("activateNativeStorageAtRestUnlock stays on unlock faces", () => {
    const offenders = runtimeAppSources.filter((file) => {
      const rel = relative(APP_ROOT, file).replace(/\\/g, "/");
      if (ACTIVATE_ALLOWLIST.has(rel)) {
        return false;
      }
      const source = readFileSync(file, "utf8");
      return /\bactivateNativeStorageAtRestUnlock\b/.test(source);
    });
    expect(offenders.map((f) => relative(APP_ROOT, f).replace(/\\/g, "/"))).toEqual([]);
  });

  it("ensureNativeSqliteOpenForWrites stays off feature send/shell probe paths", () => {
    const offenders = runtimeAppSources.filter((file) => {
      const rel = relative(APP_ROOT, file).replace(/\\/g, "/");
      if (ENSURE_ALLOWLIST.has(rel)) {
        return false;
      }
      const source = readFileSync(file, "utf8");
      return /\bensureNativeSqliteOpenForWrites\b/.test(source);
    });
    expect(offenders.map((f) => relative(APP_ROOT, f).replace(/\\/g, "/"))).toEqual([]);
  });
});
