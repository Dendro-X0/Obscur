#!/usr/bin/env node
/**
 * Full Release desktop builds are unsigned by design (no TAURI_SIGNING_* secrets).
 * tauri.conf keeps createUpdaterArtifacts=true for local signed channel work; CI must
 * flip it off when the private key is absent so `tauri build` does not exit 1 after
 * producing installers (AppImage/NSIS/DMG already built).
 *
 * Usage: node scripts/ci-prepare-unsigned-desktop-bundle.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const confPath = resolve(repoRoot, "apps/desktop/src-tauri/tauri.conf.json");

const hasKey = Boolean(
  process.env.TAURI_SIGNING_PRIVATE_KEY &&
    String(process.env.TAURI_SIGNING_PRIVATE_KEY).trim().length > 0,
);

if (hasKey) {
  console.log(
    "[ci-prepare-unsigned-desktop] TAURI_SIGNING_PRIVATE_KEY set — leaving createUpdaterArtifacts unchanged",
  );
  process.exit(0);
}

const conf = JSON.parse(readFileSync(confPath, "utf8"));
const before = conf.bundle?.createUpdaterArtifacts;
if (before === false) {
  console.log("[ci-prepare-unsigned-desktop] createUpdaterArtifacts already false");
  process.exit(0);
}

conf.bundle = conf.bundle ?? {};
conf.bundle.createUpdaterArtifacts = false;
writeFileSync(confPath, `${JSON.stringify(conf, null, 2)}\n`);
console.log(
  "[ci-prepare-unsigned-desktop] set createUpdaterArtifacts false (unsigned Full Release; pubkey present without private key)",
);
