import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTH_KERNEL_CANONICAL_MUTATION_ENTRY,
  AUTH_KERNEL_LEGACY_BRIDGE_ALLOWED_IMPORTERS,
  AUTH_KERNEL_LEGACY_BRIDGE_REMOVAL_CRITERIA,
} from "@/app/features/auth/services/auth-kernel-legacy-bridge-removal";
import {
  AUTH_KERNEL_LEGACY_BRIDGE_FILE,
  AUTH_KERNEL_LEGACY_BRIDGE_REMOVAL_FILE,
} from "./auth-kernel-subtraction-manifest";

/**
 * Platform rewrite band K3 — Auth mutation entry is kernel surface/ports only;
 * legacy delegates remain a documented bridge with removal criteria.
 */
describe("platform K3 auth mutation entry", () => {
  const featuresRoot = path.resolve(__dirname, "..");
  const pwaAppRoot = path.resolve(__dirname, "../../");
  const repoPwaRoot = path.resolve(__dirname, "../../../");

  const collectTsFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry === "dist") {
          continue;
        }
        out.push(...collectTsFiles(full));
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry) && !entry.includes(".test.") && !entry.includes(".spec.")) {
        out.push(full);
      }
    }
    return out;
  };

  const toFeaturesRelative = (file: string): string =>
    path.relative(featuresRoot, file).replace(/\\/g, "/");

  it("publishes ordered bridge removal criteria", () => {
    expect(AUTH_KERNEL_LEGACY_BRIDGE_REMOVAL_CRITERIA.length).toBeGreaterThanOrEqual(5);
    expect(AUTH_KERNEL_LEGACY_BRIDGE_REMOVAL_CRITERIA).toContain(
      "ports_own_mutations_without_authKernelIdentityActions",
    );
    expect(AUTH_KERNEL_LEGACY_BRIDGE_REMOVAL_CRITERIA).toContain(
      "maintainer_ack_scatter_shrink",
    );
    const removalSource = readFileSync(
      path.join(repoPwaRoot, AUTH_KERNEL_LEGACY_BRIDGE_REMOVAL_FILE),
      "utf8",
    );
    expect(removalSource).toContain("useAuthKernelSurfaceActions");
    expect(AUTH_KERNEL_CANONICAL_MUTATION_ENTRY).toContain("use-auth-kernel-surface-actions");
  });

  it("marks legacy-delegates as the documented bridge with removal pointer", () => {
    const bridge = readFileSync(
      path.join(repoPwaRoot, AUTH_KERNEL_LEGACY_BRIDGE_FILE),
      "utf8",
    );
    expect(bridge).toContain("rewrite-band K3");
    expect(bridge).toContain("AUTH_KERNEL_LEGACY_BRIDGE_REMOVAL_CRITERIA");
    expect(bridge).toContain("useAuthKernelSurfaceActions");
    expect(bridge).toContain("authKernelIdentityActions");
  });

  it("allows only auth-kernel adapters to import auth-kernel-legacy-delegates", () => {
    const bridgeFrom = /from\s+["'][^"']*auth-kernel-legacy-delegates["']/;
    const allow = new Set<string>(AUTH_KERNEL_LEGACY_BRIDGE_ALLOWED_IMPORTERS);
    const violations: string[] = [];

    for (const file of collectTsFiles(featuresRoot)) {
      const rel = toFeaturesRelative(file);
      if (rel.endsWith("auth/services/auth-kernel-legacy-delegates.ts")) {
        continue;
      }
      if (rel.endsWith("auth/services/auth-kernel-legacy-bridge-removal.ts")) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      if (!bridgeFrom.test(source)) {
        continue;
      }
      if (!allow.has(rel)) {
        violations.push(rel);
      }
    }

    expect(violations).toEqual([]);
    for (const allowed of AUTH_KERNEL_LEGACY_BRIDGE_ALLOWED_IMPORTERS) {
      const full = path.join(featuresRoot, allowed);
      const source = readFileSync(full, "utf8");
      expect(bridgeFrom.test(source)).toBe(true);
    }
  });

  it("forbids shell/UI production files from importing authKernelIdentityActions", () => {
    const shellRoots = [
      path.join(pwaAppRoot, "components"),
      path.join(featuresRoot, "messaging"),
      path.join(featuresRoot, "vault"),
      path.join(featuresRoot, "storage"),
      path.join(featuresRoot, "profiles"),
    ];
    const identityActionsImport =
      /authKernelIdentityActions|from\s+["'][^"']*use-identity["'][^;]*authKernelIdentityActions/;
    const violations: string[] = [];

    for (const root of shellRoots) {
      for (const file of collectTsFiles(root)) {
        const source = readFileSync(file, "utf8");
        if (!source.includes("authKernelIdentityActions")) {
          continue;
        }
        // Allow type-only / comment noise only if not a value use — fail on any mention in shell.
        if (identityActionsImport.test(source) || /\bauthKernelIdentityActions\b/.test(source)) {
          violations.push(path.relative(pwaAppRoot, file).replace(/\\/g, "/"));
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps auth-screen / lock / avatar on useAuthKernelSurfaceActions", () => {
    const surfaces = [
      "features/auth/components/auth-screen.tsx",
      "features/auth/hooks/use-app-lock-action.ts",
      "components/user-avatar-menu.tsx",
      "components/desktop/title-bar-profile-switcher.tsx",
    ];
    for (const rel of surfaces) {
      const source = readFileSync(path.join(pwaAppRoot, rel), "utf8");
      expect(source).toContain("useAuthKernelSurfaceActions");
      expect(source).not.toContain("auth-kernel-legacy-delegates");
      expect(source).not.toContain("authKernelIdentityActions");
    }
  });
});
