#!/usr/bin/env node
/**
 * G8 assist — inspect a data root for Phase 5b vault taxonomy (no unlock required).
 *
 * Usage:
 *   node scripts/vault-g8-disk-probe.mjs "D:\\ObscurData"
 *   node scripts/vault-g8-disk-probe.mjs "D:\\ObscurData" --profile alice
 */
import fs from "node:fs";
import path from "node:path";

const CATEGORIES = ["images", "videos", "audio", "files"];
const BLOB_RE = /^[a-f0-9]{24}\.obscurvault$/i;

const args = process.argv.slice(2).filter((a) => a !== "--");
const profileFilterArgIdx = args.indexOf("--profile");
const profileFilter =
  profileFilterArgIdx >= 0 ? (args[profileFilterArgIdx + 1] || "").trim() : "";
const root = args.find((a, i) => i !== profileFilterArgIdx && i !== profileFilterArgIdx + 1)?.trim();

if (!root) {
  console.error("Usage: node scripts/vault-g8-disk-probe.mjs <dataRoot> [--profile <id>]");
  process.exit(2);
}

const profilesRoot = path.join(root, "profiles");
if (!fs.existsSync(profilesRoot)) {
  console.error(`[FAIL] No profiles/ under ${root}`);
  process.exit(1);
}

const profileDirs = fs
  .readdirSync(profilesRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => !profileFilter || name === profileFilter);

if (profileDirs.length === 0) {
  console.error(`[FAIL] No matching profile directories under ${profilesRoot}`);
  process.exit(1);
}

let failures = 0;

const report = (ok, message) => {
  console.log(`${ok ? "[OK]  " : "[FAIL]"} ${message}`);
  if (!ok) failures += 1;
};

for (const profileId of profileDirs) {
  const vaultDir = path.join(profilesRoot, profileId, "vault");
  report(fs.existsSync(vaultDir), `profile ${profileId}: vault dir exists`);
  if (!fs.existsSync(vaultDir)) continue;

  for (const category of CATEGORIES) {
    const categoryDir = path.join(vaultDir, category);
    if (!fs.existsSync(categoryDir)) {
      console.log(`[INFO] profile ${profileId}: missing category dir ${category}/ (ok if unused)`);
      continue;
    }
    const files = fs.readdirSync(categoryDir).filter((name) => !name.startsWith("."));
    const bad = files.filter((name) => !BLOB_RE.test(name));
    report(
      bad.length === 0,
      `profile ${profileId}: ${category}/ has ${files.length} blob(s)${bad.length ? ` — non-blob: ${bad.join(", ")}` : ""}`,
    );
  }

  const flat = fs
    .readdirSync(vaultDir, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name);
  const flatBlobs = flat.filter((name) => BLOB_RE.test(name));
  const flatOther = flat.filter((name) => !BLOB_RE.test(name));
  if (flatBlobs.length > 0) {
    console.log(
      `[WARN] profile ${profileId}: ${flatBlobs.length} flat Phase-5 blob(s) still at vault/ root — unlock migration should move them into category dirs`,
    );
  }
  report(flatOther.length === 0, `profile ${profileId}: no plaintext/non-blob files at vault/ root`);
}

const legacy = path.join(root, "vault-media");
if (fs.existsSync(legacy)) {
  const leftover = fs.readdirSync(legacy).filter((name) => !name.startsWith("."));
  if (leftover.length === 0) {
    console.log("[OK]   legacy vault-media/ empty");
  } else {
    console.log(`[WARN] legacy vault-media/ still has ${leftover.length} entr(y/ies) — expect migrate-on-unlock`);
  }
} else {
  console.log("[OK]   legacy vault-media/ absent");
}

if (failures > 0) {
  console.error(`\nProbe failed with ${failures} error(s).`);
  process.exit(1);
}
console.log("\nProbe passed (taxonomy + ciphertext-only under scanned profiles).");
