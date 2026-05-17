#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const getArg = (name) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
};

const hasArg = (name) => process.argv.includes(name);

const listFilesRecursive = (dir) => {
  const files = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  }
  return files;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseOutputMetadata = (filePath) => {
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  const elements = Array.isArray(raw.elements) ? raw.elements : [];
  return elements
    .map((entry) => ({
      outputFile: typeof entry.outputFile === "string" ? entry.outputFile : "",
      versionName: typeof entry.versionName === "string"
        ? entry.versionName
        : (typeof raw.versionName === "string" ? raw.versionName : ""),
    }))
    .filter((entry) => entry.outputFile.length > 0);
};

const main = () => {
  const assetsDirArg = getArg("--assets-dir") ?? "release-assets";
  const assetsDir = resolve(rootDir, assetsDirArg);
  const expectedVersion = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8")).version;
  const skipAndroid = hasArg("--skip-android");

  if (!statSync(assetsDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Assets directory not found: ${assetsDir}`);
  }

  const allFiles = listFilesRecursive(assetsDir);

  const desktopExts = new Set([".exe", ".msi", ".dmg", ".appimage", ".deb"]);
  const desktopFiles = allFiles.filter((file) => desktopExts.has(extname(file).toLowerCase()));
  const versionRegex = new RegExp(`(^|[._-])v?${escapeRegex(expectedVersion)}([._-]|$)`, "i");

  const filesMissingVersionMarker = desktopFiles
    .filter((file) => !versionRegex.test(basename(file)))
    .map((file) => file.replaceAll("\\", "/"));

  if (desktopFiles.length === 0) {
    throw new Error("No desktop installer artifacts found while checking version parity.");
  }
  if (filesMissingVersionMarker.length > 0) {
    throw new Error(
      `Desktop artifacts missing version marker (${expectedVersion}) in filename:\n- ${filesMissingVersionMarker.join("\n- ")}`
    );
  }

  if (!skipAndroid) {
    const metadataFiles = allFiles
      .filter((file) => basename(file).toLowerCase() === "output-metadata.json")
      .filter((file) => file.replaceAll("\\", "/").includes("/android/"));
    if (metadataFiles.length === 0) {
      throw new Error("No Android output-metadata.json files found for versionName parity checks.");
    }

    let apkMetadataCount = 0;
    let aabMetadataCount = 0;
    const androidVersionErrors = [];

    for (const metadataFile of metadataFiles) {
      const entries = parseOutputMetadata(metadataFile);
      for (const entry of entries) {
        const lowerOutput = entry.outputFile.toLowerCase();
        if (lowerOutput.endsWith(".apk")) apkMetadataCount += 1;
        if (lowerOutput.endsWith(".aab")) aabMetadataCount += 1;
        if ((lowerOutput.endsWith(".apk") || lowerOutput.endsWith(".aab")) && entry.versionName !== expectedVersion) {
          androidVersionErrors.push(
            `${metadataFile.replaceAll("\\", "/")} :: ${entry.outputFile} has versionName=${entry.versionName || "<missing>"}`
          );
        }
      }
    }

    if (apkMetadataCount === 0 || aabMetadataCount === 0) {
      throw new Error(
        `Android metadata parity requires APK and AAB entries. Found apk_entries=${apkMetadataCount}, aab_entries=${aabMetadataCount}.`
      );
    }
    if (androidVersionErrors.length > 0) {
      throw new Error(
        `Android metadata versionName mismatch (expected ${expectedVersion}):\n- ${androidVersionErrors.join("\n- ")}`
      );
    }

    console.log(
      `[release:artifact-version-parity] Version parity passed for desktop installers and Android metadata (version=${expectedVersion}).`
    );
    return;
  }

  console.log(
    `[release:artifact-version-parity] Desktop installer version parity passed (version=${expectedVersion}); Android parity skipped by --skip-android.`
  );
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[release:artifact-version-parity] Failed: ${message}`);
  process.exit(1);
}
