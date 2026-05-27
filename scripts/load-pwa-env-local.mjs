#!/usr/bin/env node
/**
 * Merge NEXT_PUBLIC_* (and OBSCUR_*) vars from apps/pwa/.env.local into process.env.
 * Used by dev-desktop so Tauri dev builds pick up coordination URL without a manual export.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envLocalPath = resolve(repoRoot, "apps/pwa/.env.local");

const unquote = (value) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

/** @returns {Record<string, string>} */
export function readPwaEnvLocal() {
  if (!existsSync(envLocalPath)) {
    return {};
  }
  const out = {};
  for (const line of readFileSync(envLocalPath, "utf8").split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (!/^(NEXT_PUBLIC_|OBSCUR_)/u.test(key)) {
      continue;
    }
    out[key] = unquote(trimmed.slice(eq + 1));
  }
  return out;
}

/** @param {NodeJS.ProcessEnv} base */
export function mergePwaEnvLocal(base) {
  const merged = { ...base };
  for (const [key, value] of Object.entries(readPwaEnvLocal())) {
    if (!merged[key]?.trim()) {
      merged[key] = value;
    }
  }
  return merged;
}
