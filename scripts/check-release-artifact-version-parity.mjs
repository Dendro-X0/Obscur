#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertDesktopInstallerBasename,
  readExpectedReleaseVersion,
  versionMarkerRegex,
} from "./lib/release-artifact-version.mjs";

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

const parseOutputMetadata = (filePath) => {
  const raw = JSON.parse(readFileSync(filePath, "utf8"));
  const rootVersionName = typeof raw.versionName === "string" ? raw.versionName.trim() : "";
  const elements = Array.isArray(raw.elements) ? raw.elements : [];
  return {
    rootVersionName,
    entries: elements
      .map((entry) => ({
        outputFile: typeof entry.outputFile === "string" ? entry.outputFile : "",
        versionName: typeof entry.versionName === "string"
          ? entry.versionName.trim()
          : rootVersionName,
      }))
      .filter((entry) => entry.outputFile.length > 0),
  };
};

const readTauriAndroidVersionName = (files) => {
  for (const file of files) {
    if (!file.replaceAll("\\", "/").includes("/android/")) continue;
    if (basename(file).toLowerCase() !== "tauri.properties") continue;
    const content = readFileSync(file, "utf8");
    const match = content.match(/^tauri\.android\.versionName=(.+)$/m);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  return null;
};

const collectMetadataVersionNames = ({ rootVersionName, entries }) => {
  const names = new Set();
  if (rootVersionName) {
    names.add(rootVersionName);
  }
  for (const entry of entries) {
    if (entry.versionName) {
      names.add(entry.versionName);
    }
  }
  return names;
};

const main = () => {
  const assetsDirArg = getArg("--assets-dir") ?? "release-assets";
  const assetsDir = resolve(rootDir, assetsDirArg);
  const rawExpectedVersion = getArg("--expected-version") ?? readExpectedReleaseVersion(rootDir);
  const expectedVersion = rawExpectedVersion.startsWith("v")
    ? rawExpectedVersion.slice(1)
    : rawExpectedVersion;
  const skipAndroid = hasArg("--skip-android");

  if (!statSync(assetsDir, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`Assets directory not found: ${assetsDir}`);
  }

  const allFiles = listFilesRecursive(assetsDir);

  const desktopExts = new Set([".exe", ".msi", ".dmg", ".appimage", ".deb"]);
  const desktopFiles = allFiles.filter((file) => desktopExts.has(extname(file).toLowerCase()));
  const markerRegex = versionMarkerRegex(expectedVersion);

  const desktopErrors = [];
  for (const file of desktopFiles) {
    const name = basename(file);
    const semverCheck = assertDesktopInstallerBasename(name, expectedVersion);
    if (!semverCheck.ok) {
      desktopErrors.push(semverCheck.error);
      continue;
    }
    if (!markerRegex.test(name)) {
      desktopErrors.push(`desktop filename missing version marker ${expectedVersion}: ${name}`);
    }
  }

  if (desktopFiles.length === 0) {
    throw new Error("No desktop installer artifacts found while checking version parity.");
  }
  if (desktopErrors.length > 0) {
    throw new Error(`Desktop version parity failed:\n- ${desktopErrors.join("\n- ")}`);
  }

  if (!skipAndroid) {
    const metadataFiles = allFiles
      .filter((file) => basename(file).toLowerCase() === "output-metadata.json")
      .filter((file) => file.replaceAll("\\", "/").includes("/android/"));

    const apkBinaries = allFiles.filter((file) => basename(file).toLowerCase().endsWith(".apk"));
    const aabBinaries = allFiles.filter((file) => basename(file).toLowerCase().endsWith(".aab"));
    if (aabBinaries.length === 0) {
      throw new Error("No Android AAB binaries found under release-assets.");
    }
    if (apkBinaries.length === 0) {
      console.warn(
        "[release:artifact-version-parity] No APK binaries under release-assets; validating AAB-only artifact set.",
      );
    }

    if (metadataFiles.length === 0) {
      const propsVersion = readTauriAndroidVersionName(allFiles);
      if (propsVersion && propsVersion !== expectedVersion) {
        throw new Error(
          `Android tauri.properties versionName=${propsVersion} does not match expected ${expectedVersion}.`,
        );
      }
      console.warn(
        `[release:artifact-version-parity] No output-metadata.json under release-assets/android; accepted AAB binary using --expected-version=${expectedVersion}.`,
      );
      console.log(
        `[release:artifact-version-parity] Version parity passed for desktop installers and Android AAB-only artifacts (version=${expectedVersion}, aab_binaries=${aabBinaries.length}).`,
      );
      return;
    }

    let apkMetadataCount = 0;
    let aabMetadataCount = 0;
    const androidVersionErrors = [];
    const metadataVersionNames = new Set();
    const tauriPropertiesVersion = readTauriAndroidVersionName(allFiles);
    if (tauriPropertiesVersion) {
      metadataVersionNames.add(tauriPropertiesVersion);
    }

    for (const metadataFile of metadataFiles) {
      const parsed = parseOutputMetadata(metadataFile);
      for (const name of collectMetadataVersionNames(parsed)) {
        metadataVersionNames.add(name);
      }
      for (const entry of parsed.entries) {
        const lowerOutput = entry.outputFile.toLowerCase();
        if (lowerOutput.endsWith(".apk")) apkMetadataCount += 1;
        if (lowerOutput.endsWith(".aab")) aabMetadataCount += 1;
        if (
          (lowerOutput.endsWith(".apk") || lowerOutput.endsWith(".aab"))
          && entry.versionName
          && entry.versionName !== expectedVersion
        ) {
          androidVersionErrors.push(
            `${metadataFile.replaceAll("\\", "/")} :: ${entry.outputFile} has versionName=${entry.versionName}`,
          );
        }
      }
    }

    const mobileBinaries = [...apkBinaries, ...aabBinaries];
    for (const file of mobileBinaries) {
      const name = basename(file);
      if (name.startsWith("Obscur_")) {
        const semverCheck = assertDesktopInstallerBasename(name, expectedVersion);
        if (!semverCheck.ok) {
          androidVersionErrors.push(semverCheck.error);
        }
      }
    }

    if (apkMetadataCount === 0 && aabMetadataCount === 0 && metadataVersionNames.size === 0) {
      if (apkBinaries.length > 0) {
        throw new Error(
          "Android output-metadata.json files are present but contain no APK/AAB rows or versionName fields.",
        );
      }
      console.warn(
        `[release:artifact-version-parity] No output-metadata rows; accepted AAB binary using --expected-version=${expectedVersion}.`,
      );
    } else if (apkMetadataCount === 0 && apkBinaries.length > 0) {
      throw new Error(
        `Android metadata parity requires at least one APK entry in output-metadata.json. Found apk_entries=${apkMetadataCount}.`,
      );
    }

    if (aabMetadataCount === 0) {
      const fallbackVersion = [...metadataVersionNames][0] ?? expectedVersion;
      if (fallbackVersion !== expectedVersion) {
        androidVersionErrors.push(
          `AAB binary present but metadata only documents versionName=${fallbackVersion} (expected ${expectedVersion}).`,
        );
      } else if (metadataVersionNames.size === 0) {
        console.warn(
          `[release:artifact-version-parity] No AAB rows or versionName in metadata; accepted AAB binary using --expected-version=${expectedVersion}.`,
        );
      } else {
        console.warn(
          "[release:artifact-version-parity] No AAB rows in output-metadata.json; accepted AAB binary with versionName from APK metadata or tauri.properties.",
        );
      }
    }

    if (androidVersionErrors.length > 0) {
      throw new Error(
        `Android version parity mismatch (expected ${expectedVersion}):\n- ${androidVersionErrors.join("\n- ")}`,
      );
    }

    console.log(
      `[release:artifact-version-parity] Version parity passed for desktop installers and Android artifacts (version=${expectedVersion}, apk_metadata=${apkMetadataCount}, aab_metadata=${aabMetadataCount}, aab_binaries=${aabBinaries.length}).`,
    );
    return;
  }

  console.log(
    `[release:artifact-version-parity] Desktop installer version parity passed (version=${expectedVersion}); Android parity skipped by --skip-android.`,
  );
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[release:artifact-version-parity] Failed: ${message}`);
  process.exit(1);
}
