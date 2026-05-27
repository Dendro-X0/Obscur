#!/usr/bin/env node
/**
 * v1.9.0 B0 — feature code must not import @dweb/nostr directly (adapter owner only).
 * Allowlist shrinks as files migrate to @dweb/transport-nostr / gateway transport port.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const featuresRoot = path.join(repoRoot, "apps/pwa/app/features");
const allowlistPath = path.join(repoRoot, "scripts/transport-nostr-feature-allowlist.json");

const IGNORE_SUFFIXES = [".test.ts", ".test.tsx", "/__tests__/"];

/** Owner paths — may import @dweb/nostr until adapter fully owns wire I/O */
const OWNER_RELATIVE_PATHS = new Set([
  "groups/services/community-transport-owner.ts",
  "groups/services/community-membership-semantic-ingress.ts",
  "groups/services/community-membership-port-owner.ts",
  "runtime/services/client-gateway-adapter.ts",
]);

const normalizePath = (relativePath) => relativePath.replace(/\\/g, "/");

const shouldIgnoreFile = (relativePath) => (
  IGNORE_SUFFIXES.some((suffix) => relativePath.includes(suffix))
  || OWNER_RELATIVE_PATHS.has(relativePath)
);

const walkTsFiles = async (dir, base = "") => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await walkTsFiles(path.join(dir, entry.name), relative));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) {
      continue;
    }
    const normalized = normalizePath(relative);
    if (shouldIgnoreFile(normalized)) {
      continue;
    }
    files.push({ abs: path.join(dir, entry.name), relative: normalized });
  }
  return files;
};

const detectNostrImport = (source) => {
  const patterns = [
    /from\s+["']@dweb\/nostr/g,
    /import\s*\(\s*["']@dweb\/nostr/g,
  ];
  return patterns.some((pattern) => pattern.test(source));
};

const loadAllowlist = async () => {
  try {
    const raw = await readFile(allowlistPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.allowedRelativePaths)) {
      throw new Error("allowedRelativePaths must be an array");
    }
    return new Set(parsed.allowedRelativePaths.map(normalizePath));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

const main = async () => {
  const files = await walkTsFiles(featuresRoot);
  const importers = [];
  for (const file of files) {
    const source = await readFile(file.abs, "utf8");
    if (detectNostrImport(source)) {
      importers.push(file.relative);
    }
  }

  const allowlist = await loadAllowlist();
  if (!allowlist) {
    const payload = {
      _comment: "v1.9.0 B0 baseline — shrink as files migrate off @dweb/nostr",
      allowedRelativePaths: importers.sort(),
    };
    await import("node:fs/promises").then(({ writeFile }) => writeFile(
      allowlistPath,
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8",
    ));
    console.warn(`[transport:boundaries] Created allowlist with ${importers.length} paths. Re-run to enforce.`);
    process.exit(0);
  }

  const violations = importers.filter((relative) => !allowlist.has(relative));
  const staleAllow = [...allowlist].filter((relative) => !importers.includes(relative));

  if (violations.length > 0) {
    console.error("[transport:boundaries] New @dweb/nostr imports in app/features (not allowlisted):");
    violations.forEach((relative) => console.error(`  - ${relative}`));
    console.error("Migrate to @dweb/transport-nostr or add to allowlist only for legacy debt.");
    process.exit(1);
  }

  if (staleAllow.length > 0) {
    console.warn("[transport:boundaries] Allowlist entries with no remaining import (shrink allowlist):");
    staleAllow.forEach((relative) => console.warn(`  - ${relative}`));
  }

  console.log(`[transport:boundaries] OK — ${importers.length} allowlisted @dweb/nostr import sites in features.`);
};

main().catch((error) => {
  console.error("[transport:boundaries] Failed:", error);
  process.exit(1);
});
