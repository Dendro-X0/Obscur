#!/usr/bin/env node
/** D2 — smoke for hide registry snapshot round-trip (gateway persist contract). */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const loadSnapshot = (filePath) => {
  if (!existsSync(filePath)) return new Set();
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    const ids = Array.isArray(parsed.hiddenEventIds) ? parsed.hiddenEventIds : [];
    return new Set(ids.filter((id) => typeof id === "string" && id.trim().length > 0));
  } catch {
    return new Set();
  }
};

const saveSnapshot = (filePath, hiddenEventIds) => {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    filePath,
    `${JSON.stringify({
      hiddenEventIds: Array.from(hiddenEventIds).sort(),
      updatedAt: new Date().toISOString(),
    }, null, 2)}\n`,
    "utf8",
  );
};

const main = () => {
  const dir = mkdtempSync(join(tmpdir(), "obscur-hide-smoke-"));
  const path = join(dir, "hide-registry.json");
  const id = "cc".repeat(32);
  try {
    saveSnapshot(path, new Set([id]));
    const loaded = loadSnapshot(path);
    if (!loaded.has(id)) {
      console.error("[hide-registry-persist-smoke] round-trip failed");
      process.exit(1);
    }
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!Array.isArray(parsed.hiddenEventIds) || parsed.hiddenEventIds[0] !== id) {
      console.error("[hide-registry-persist-smoke] invalid snapshot shape");
      process.exit(1);
    }
    console.log("[hide-registry-persist-smoke] D2 persist contract OK");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

main();
