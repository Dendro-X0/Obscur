#!/usr/bin/env node
/**
 * D2 — Compact hidden community message ids from nostr-rs-relay SQLite storage.
 *
 * Reads hide registry JSON (from relay-gateway persist) and DELETEs matching rows.
 * Requires `sqlite3` CLI on PATH. Stop relay or use copy of DB for safety.
 *
 * Usage:
 *   node scripts/operator-relay-storage-compact.mjs \
 *     --registry apps/relay-gateway/data/hide-registry.json \
 *     --db infra/nostr/data/nostr.db
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const parseArgs = (argv) => {
  const args = argv.slice(2);
  const getArg = (name, fallback) => {
    const i = args.indexOf(name);
    if (i === -1 || !args[i + 1]) return fallback;
    return args[i + 1];
  };
  return {
    registryPath: resolve(repoRoot, getArg("--registry", "apps/relay-gateway/data/hide-registry.json")),
    dbPath: resolve(repoRoot, getArg("--db", "infra/nostr/data/nostr.db")),
    dryRun: args.includes("--dry-run"),
  };
};

/** Nostr event id (hex) → SQL blob literal for nostr-rs-relay `event_hash` column. */
export const eventIdToSqlBlob = (eventId) => {
  const hex = eventId.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error(`Invalid event id hex: ${eventId.slice(0, 16)}…`);
  }
  return `x'${hex}'`;
};

export const loadHiddenIdsFromRegistry = (path) => {
  if (!existsSync(path)) {
    throw new Error(`registry not found: ${path}`);
  }
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const ids = Array.isArray(parsed.hiddenEventIds) ? parsed.hiddenEventIds : [];
  return ids.filter((id) => typeof id === "string" && id.trim().length > 0);
};

export const buildCompactDeleteSql = (eventId) => (
  `DELETE FROM event WHERE event_hash = ${eventIdToSqlBlob(eventId)};`
);

const runSqlite = (db, sql) => {
  const result = spawnSync("sqlite3", [db, sql], { encoding: "utf8" });
  if (result.error) {
    throw new Error(`sqlite3 failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`sqlite3 exit ${result.status}: ${result.stderr}`);
  }
  return (result.stdout ?? "").trim();
};

export const compactHiddenEvents = (params) => {
  const { registryPath, dbPath, dryRun = false } = params;
  if (!existsSync(dbPath)) {
    throw new Error(`database not found: ${dbPath}`);
  }
  const hiddenIds = loadHiddenIdsFromRegistry(registryPath);
  if (hiddenIds.length === 0) {
    return { processed: 0, dryRun };
  }

  runSqlite(dbPath, "PRAGMA foreign_keys = ON;");

  let processed = 0;
  for (const id of hiddenIds) {
    const sql = buildCompactDeleteSql(id);
    if (dryRun) {
      console.log(`[dry-run] ${sql}`);
    } else {
      runSqlite(dbPath, `PRAGMA foreign_keys = ON; ${sql}`);
      console.log(`[operator-relay-compact] deleted event_hash=${id.slice(0, 16)}…`);
    }
    processed += 1;
  }
  return { processed, dryRun };
};

const main = () => {
  const { registryPath, dbPath, dryRun } = parseArgs(process.argv);

  try {
    if (!existsSync(dbPath)) {
      console.error(`[operator-relay-compact] database not found: ${dbPath}`);
      console.error("Hint: copy from Docker volume or set --db to nostr-rs-relay data path.");
      process.exit(1);
    }

    const hiddenIds = loadHiddenIdsFromRegistry(registryPath);
    if (hiddenIds.length === 0) {
      console.log("[operator-relay-compact] no hidden ids in registry — nothing to compact.");
      return;
    }

    console.log(`[operator-relay-compact] registry=${registryPath}`);
    console.log(`[operator-relay-compact] db=${dbPath} ids=${hiddenIds.length} dryRun=${dryRun}`);

    const result = compactHiddenEvents({ registryPath, dbPath, dryRun });
    console.log(`[operator-relay-compact] done — processed ${result.processed} id(s).`);
    console.log("[operator-relay-compact] Off-relay and client-local copies may still exist.");
  } catch (error) {
    console.error(`[operator-relay-compact] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

const isDirectRun = process.argv[1]
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  main();
}
