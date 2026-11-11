import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 4.1 — K-PWA-MEGA-IMPORT fence for DeviceUnlock adapter path.
 * Vite unlock must use @obscur/auth-engine / local handlers — never AuthGateway / MessagingProvider.
 * @see specs/backend/cut4-vite-native-port-wire-design-2026-11-09.md
 */

const SRC_ROOT = join(fileURLToPath(new URL(".", import.meta.url)));

const FORBIDDEN_PATTERNS: ReadonlyArray<Readonly<{ id: string; re: RegExp }>> = [
  // Import forms only — AuthDoor may document Single-door parity with AuthGateway by name.
  { id: "AuthGateway import", re: /\bimport\b[^;]*\bAuthGateway\b/ },
  { id: "MessagingProvider", re: /\bMessagingProvider\b/ },
  { id: "createAuthKernelDeviceUnlockPort", re: /\bcreateAuthKernelDeviceUnlockPort\b/ },
  { id: "apps/pwa feature import", re: /from\s+["'][^"']*apps\/pwa\// },
  { id: "pwa @/app feature deep import", re: /from\s+["']@\/app\/features\// },
];

const REQUIRED_AUTH_ENGINE_IMPORT = /from\s+["']@obscur\/auth-engine["']/;

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

describe("Cut 4.1 desktop-ui no pwa unlock mega-import", () => {
  it("forbids AuthGateway / MessagingProvider / auth-kernel imports in src/", () => {
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

  it("vite-native-device-unlock imports @obscur/auth-engine", () => {
    const source = readFileSync(join(SRC_ROOT, "auth/vite-native-device-unlock.ts"), "utf8");
    expect(REQUIRED_AUTH_ENGINE_IMPORT.test(source)).toBe(true);
    expect(source).toContain("createDelegatingDeviceUnlockPort");
    expect(source).toContain("createUnavailableDeviceUnlockPort");
  });
});
