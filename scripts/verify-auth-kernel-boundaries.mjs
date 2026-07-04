#!/usr/bin/env node
/**
 * AUTH-K0 boundary guard — package purity + legacy scatter quarantine markers.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authPackageRoot = path.join(repoRoot, "packages/dweb-auth/src");
const authKernelRoot = path.join(repoRoot, "apps/pwa/app/features/auth-kernel");

const PACKAGE_FORBIDDEN_IMPORT_FRAGMENTS = [
  "react",
  "next/",
  "@dweb/nostr",
  "framer-motion",
  "apps/pwa",
  "features/auth/hooks/use-identity",
];

const LEGACY_SCATTER_FILES = [
  "apps/pwa/app/features/auth/hooks/use-identity.ts",
  "apps/pwa/app/features/auth/components/auth-gateway.tsx",
];

const LEGACY_SCATTER_QUARANTINE_MARKER = "AUTH-K0 scatter — do not expand restore owners here";

async function listTypeScriptFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listTypeScriptFiles(fullPath));
      continue;
    }
    if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

function relativeFromRepo(absPath) {
  return path.relative(repoRoot, absPath).replaceAll("\\", "/");
}

async function assertPackagePurity() {
  const files = await listTypeScriptFiles(authPackageRoot);
  const violations = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const fragment of PACKAGE_FORBIDDEN_IMPORT_FRAGMENTS) {
      if (source.includes(fragment)) {
        violations.push(`${relativeFromRepo(file)}: forbidden fragment "${fragment}"`);
      }
    }
  }
  if (violations.length > 0) {
    throw new Error(`@dweb/auth boundary violations:\n${violations.join("\n")}`);
  }
}

async function assertAuthKernelManifestPresent() {
  const manifestPath = path.join(authKernelRoot, "auth-kernel-subtraction-manifest.ts");
  const source = await readFile(manifestPath, "utf8");
  if (!source.includes("AUTH_KERNEL_LEGACY_SCATTER_FILES")) {
    throw new Error("auth-kernel-subtraction-manifest.ts missing legacy scatter registry");
  }
}

async function assertLegacyScatterQuarantineMarkers() {
  const missing = [];
  for (const relativePath of LEGACY_SCATTER_FILES) {
    const absPath = path.join(repoRoot, relativePath);
    const source = await readFile(absPath, "utf8");
    if (!source.includes(LEGACY_SCATTER_QUARANTINE_MARKER)) {
      missing.push(relativePath);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Legacy scatter files missing quarantine marker "${LEGACY_SCATTER_QUARANTINE_MARKER}":\n${missing.join("\n")}`,
    );
  }
}

async function assertLegacyBridgePresent() {
  const bridgePath = path.join(repoRoot, "apps/pwa/app/features/auth/services/auth-kernel-legacy-delegates.ts");
  const source = await readFile(bridgePath, "utf8");
  if (!source.includes("authKernelIdentityActions")) {
    throw new Error("auth-kernel-legacy-delegates.ts missing canonical identity action bridge");
  }
}

async function main() {
  await assertPackagePurity();
  await assertAuthKernelManifestPresent();
  await assertLegacyBridgePresent();
  await assertLegacyScatterQuarantineMarkers();
  console.log("verify-auth-kernel-boundaries: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
