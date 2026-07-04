#!/usr/bin/env node
/**
 * Copy a built Android debug APK into release-assets/ and update manifest.json.
 *
 * Does NOT compile — run after `pnpm build:android:debug:emulator` when the machine is idle.
 *
 * Usage:
 *   pnpm release:record-android-debug-apk
 *   pnpm release:record-android-debug-apk -- --apk path/to/app-debug.apk
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readExpectedReleaseVersion } from "./lib/release-artifact-version.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS_ANDROID = path.join(repoRoot, "release-assets", "android");
const MANIFEST_PATH = path.join(repoRoot, "release-assets", "manifest.json");
const OUTPUTS_ROOT = path.join(
  repoRoot,
  "apps/desktop/src-tauri/gen/android/app/build/outputs/apk",
);

const getArg = (name) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
};

const findNewestApk = (root) => {
  const candidates = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.name.endsWith(".apk")) {
        candidates.push(full);
      }
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return candidates[0];
};

const resolveApkPath = (explicit) => {
  if (explicit) {
    const resolved = path.resolve(process.cwd(), explicit);
    if (!existsSync(resolved)) {
      throw new Error(`APK not found: ${resolved}`);
    }
    return resolved;
  }
  if (!existsSync(OUTPUTS_ROOT)) {
    throw new Error(
      "No Android build outputs — run `pnpm build:android:debug:emulator` first (when machine is idle).",
    );
  }
  const apk = findNewestApk(OUTPUTS_ROOT);
  if (!apk) {
    throw new Error("No .apk under gen/android/app/build/outputs/apk — build first.");
  }
  return apk;
};

const sha256File = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });

const readGitCommit = () => {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status === 0 && result.stdout?.trim()) {
    return result.stdout.trim();
  }
  return "unknown";
};

async function main() {
  const explicitApk = getArg("--apk");
  const sourceApk = resolveApkPath(explicitApk);
  const version = readExpectedReleaseVersion(repoRoot);
  const fileName = `Obscur_${version}_android-debug.apk`;
  const destApk = path.join(ASSETS_ANDROID, fileName);
  const relPath = path.relative(repoRoot, destApk).replaceAll("\\", "/");

  mkdirSync(ASSETS_ANDROID, { recursive: true });
  copyFileSync(sourceApk, destApk);

  const sizeBytes = statSync(destApk).size;
  const sha256 = await sha256File(destApk);
  const gitCommit = readGitCommit();
  const generatedAt = new Date().toISOString();

  let manifest;
  if (existsSync(MANIFEST_PATH)) {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } else {
    manifest = {
      schema: "obscur.release-assets.manifest@1.0.0",
      version,
      signingPolicy: "unsigned",
      artifacts: [],
      notes: [],
    };
  }

  manifest.generatedAt = generatedAt;
  manifest.version = version;
  if (gitCommit !== "unknown") {
    manifest.gitCommit = gitCommit;
  }
  manifest.buildCommand = manifest.buildCommand ?? "pnpm desktop:package";
  manifest.androidBuildCommand = "pnpm build:android:debug:emulator";

  const androidArtifact = {
    platform: "android",
    kind: "debug-apk",
    path: relPath,
    fileName,
    sizeBytes,
    sha256,
    sourceApk: path.relative(repoRoot, sourceApk).replaceAll("\\", "/"),
    recordedAt: generatedAt,
  };

  manifest.artifacts = (manifest.artifacts ?? []).filter(
    (item) => !(item.platform === "android" && item.kind === "debug-apk"),
  );
  manifest.artifacts.push(androidArtifact);

  const note = `Phase 3 P3-3 — Android debug APK recorded ${generatedAt.slice(0, 10)}`;
  manifest.notes = [...new Set([...(manifest.notes ?? []), note])];

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log("[release:record-android-debug-apk] Recorded Android debug APK");
  console.log(`  source: ${sourceApk}`);
  console.log(`  dest:   ${destApk}`);
  console.log(`  sha256: ${sha256}`);
  console.log(`  size:   ${sizeBytes} bytes`);
  console.log(`  manifest: ${MANIFEST_PATH}`);
}

main().catch((error) => {
  console.error(`[release:record-android-debug-apk] ${error.message}`);
  process.exit(1);
});
