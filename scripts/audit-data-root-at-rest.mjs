#!/usr/bin/env node
/**
 * v1.9.8 Phase 4 — quick filesystem audit for encryption-at-rest evidence.
 * Run while Obscur is LOCKED (not merely quit) for T1/T2 checks.
 *
 * Usage:
 *   node scripts/audit-data-root-at-rest.mjs "E:/app.obscur.desktop"
 */

import fs from "node:fs";
import path from "node:path";

const root = process.argv[2]?.trim();
if (!root) {
  console.error("Usage: node scripts/audit-data-root-at-rest.mjs <data-root-path>");
  process.exit(1);
}

const resolved = path.resolve(root);
if (!fs.existsSync(resolved)) {
  console.error(`Path does not exist: ${resolved}`);
  process.exit(1);
}

const SQLITE_PLAIN = "obscur.sqlite3";
const SQLITE_ENC = "obscur.sqlite3.obscur-enc";
const SQLITE_MAGIC = Buffer.from("SQLite format 3\0");

function readHeader(filePath, len = 16) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, 0);
    fs.closeSync(fd);
    return buf;
  } catch {
    return null;
  }
}

function listVaultFiles(vaultDir) {
  if (!fs.existsSync(vaultDir)) {
    return [];
  }
  const entries = [];
  for (const name of fs.readdirSync(vaultDir)) {
    const full = path.join(vaultDir, name);
    if (fs.statSync(full).isFile()) {
      entries.push(name);
    }
  }
  return entries;
}

const plainPath = path.join(resolved, SQLITE_PLAIN);
const encPath = path.join(resolved, SQLITE_ENC);
const vaultDir = path.join(resolved, "vault-media");
const archivesDir = path.join(resolved, "profile-archives");

const hasPlain = fs.existsSync(plainPath);
const hasEnc = fs.existsSync(encPath);
const plainHeader = hasPlain ? readHeader(plainPath) : null;
const plainSqlite = plainHeader?.slice(0, 16).equals(SQLITE_MAGIC) ?? false;

const vaultFiles = listVaultFiles(vaultDir);
const plaintextVaultExt = vaultFiles.filter((name) =>
  /\.(jpg|jpeg|png|gif|webp|mp4|mov|pdf|txt)$/i.test(name),
);

let archiveFiles = [];
if (fs.existsSync(archivesDir)) {
  archiveFiles = fs.readdirSync(archivesDir).filter((n) => n.endsWith(".json"));
}

const checks = [];

if (hasEnc) {
  checks.push({ id: "sqlite-enc-sidecar", pass: true, detail: SQLITE_ENC });
} else {
  checks.push({ id: "sqlite-enc-sidecar", pass: false, detail: `${SQLITE_ENC} missing` });
}

if (!hasPlain) {
  checks.push({ id: "sqlite-plain-absent", pass: true, detail: "no plaintext db file" });
} else if (!plainSqlite) {
  checks.push({ id: "sqlite-plain-absent", pass: true, detail: "obscur.sqlite3 present but not SQLite plaintext header" });
} else {
  checks.push({
    id: "sqlite-plain-absent",
    pass: false,
    detail: "obscur.sqlite3 readable as plaintext SQLite — lock may not have run or another profile still unlocked",
  });
}

checks.push({
  id: "vault-no-plain-ext",
  pass: plaintextVaultExt.length === 0,
  detail: plaintextVaultExt.length === 0 ? "vault-media empty or opaque names only" : plaintextVaultExt.join(", "),
});

const plaintextArchives = archiveFiles.filter((n) => n.endsWith(".obscur-profile.json") && !n.includes(".enc."));
checks.push({
  id: "archives-encrypted",
  pass: plaintextArchives.length === 0,
  detail:
    plaintextArchives.length === 0
      ? "no plaintext removal archives"
      : `${plaintextArchives.length} plaintext archive(s): ${plaintextArchives.join(", ")}`,
});

console.log(`Data root audit: ${resolved}`);
console.log(`Locked-state expectation: obscur.sqlite3.obscur-enc present; plaintext SQLite header absent.\n`);

let allPass = true;
for (const check of checks) {
  const mark = check.pass ? "PASS" : "FAIL";
  if (!check.pass) allPass = false;
  console.log(`[${mark}] ${check.id}: ${check.detail}`);
}

console.log(allPass ? "\nOverall: PASS (T1/T2 filesystem evidence)" : "\nOverall: FAIL — see items above");
process.exit(allPass ? 0 : 1);
