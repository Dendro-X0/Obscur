#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const workflowPath = resolve(rootDir, ".github/workflows/release.yml");

const content = readFileSync(workflowPath, "utf8");

const requiredSnippets = [
  "release-assets/windows",
  "release-assets/macos",
  "release-assets/linux",
  "release-assets/android",
  "release-assets/web",
  "latest.json",
  "streaming-update-policy.json",
  "streaming-update-assets",
  "*.exe",
  "*.msi",
  "*.dmg",
  "*.appimage",
  "*.deb",
  "*.apk",
  "*.aab",
  "*.tar.gz",
  "output-metadata.json",
  "release:artifact-version-parity",
  // Phase B multi-arch artifact names / download patterns
  // Linux/Windows ARM deferred until Tor Expert Bundle ships those triples.
  "desktop-windows-x86_64",
  "desktop-macos-aarch64",
  "desktop-macos-x86_64",
  "desktop-linux-x86_64",
  "desktop-windows-*",
  "desktop-macos-*",
  "desktop-linux-*",
  "use_host_target",
];

const missing = requiredSnippets.filter((snippet) => !content.toLowerCase().includes(snippet.toLowerCase()));
const hasAndroidParityCoverage = content.toLowerCase().includes("run android artifact version parity check (non-blocking)")
  || content.toLowerCase().includes("run release artifact version parity check (desktop + android)");
if (!hasAndroidParityCoverage) {
  missing.push("Run Android artifact version parity check (non-blocking)");
}
if (missing.length > 0) {
  console.error("[release:artifact-matrix] Missing required workflow snippets:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("[release:artifact-matrix] Workflow matrix assertions are present.");
