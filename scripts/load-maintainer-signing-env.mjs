#!/usr/bin/env node
/**
 * Load .env.signing.local into process.env (maintainer machine only).
 * Used by desktop:package and optional Android release builds.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(repoRoot, ".env.signing.local");

export function loadMaintainerSigningEnv() {
  if (!existsSync(envPath)) {
    return false;
  }
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return true;
}

const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const loaded = loadMaintainerSigningEnv();
  console.log(loaded ? `[signing-env] Loaded ${envPath}` : `[signing-env] No ${envPath} (optional)`);
}
