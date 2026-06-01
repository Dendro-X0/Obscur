#!/usr/bin/env node
/**
 * P12 — Android P1 wrap-up smoke helper (maintainer machine).
 *
 * Prerequisites → optional emulator debug build → adb install → cold start.
 * Manual rows 3–4 (unlock, DM/community path) remain human-verified.
 *
 * Usage:
 *   pnpm p12:android-smoke
 *   pnpm p12:android-smoke -- --build
 *   pnpm p12:android-smoke -- --wait-device=180
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readExpectedReleaseVersion } from "./lib/release-artifact-version.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ANDROID_PACKAGE = "app.obscur.desktop";
const MAIN_ACTIVITY = `${ANDROID_PACKAGE}/.MainActivity`;
const DEFAULT_APK = path.join(
  repoRoot,
  "apps/desktop/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk",
);

const getArg = (name) => {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
};

const getFlagValue = (prefix) => {
  const match = process.argv.find((arg) => arg.startsWith(`${prefix}=`));
  if (!match) return null;
  return match.slice(prefix.length + 1);
};

const sleepMs = (ms) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    // busy-wait — avoids shell-specific sleep binaries on Windows
  }
};

const run = (command, args, options = {}) => {
  const useShell = options.shell ?? process.platform === "win32";
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: useShell,
    ...options,
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
    status: result.status ?? 1,
  };
};

const resolveAdb = () => {
  const onPath = run("adb", ["version"], { shell: false });
  if (onPath.ok) {
    return "adb";
  }
  const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  if (!sdkRoot) return null;
  const candidate = path.join(
    sdkRoot,
    "platform-tools",
    process.platform === "win32" ? "adb.exe" : "adb",
  );
  return existsSync(candidate) ? candidate : null;
};

const resolveApkPath = (explicit) => {
  if (explicit) {
    const resolved = path.resolve(process.cwd(), explicit);
    if (!existsSync(resolved)) {
      throw new Error(`APK not found: ${resolved}`);
    }
    return resolved;
  }
  if (existsSync(DEFAULT_APK)) {
    return DEFAULT_APK;
  }
  const outputsRoot = path.join(
    repoRoot,
    "apps/desktop/src-tauri/gen/android/app/build/outputs/apk",
  );
  if (!existsSync(outputsRoot)) {
    throw new Error("No Android APK outputs — run `pnpm build:android:debug:emulator` first.");
  }
  const candidates = [];
  const stack = [outputsRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".apk") && entry.name.toLowerCase().includes("debug")) {
        candidates.push(full);
      }
    }
  }
  candidates.sort((a, b) => {
    const score = (file) => {
      const base = path.basename(file).toLowerCase();
      if (base.includes("universal")) return 0;
      if (base.includes("x86_64")) return 1;
      return 2;
    };
    return score(a) - score(b);
  });
  if (candidates.length === 0) {
    throw new Error("No debug APK found under gen/android/app/build/outputs/apk.");
  }
  return candidates[0];
};

const readApkVersionName = (apkPath) => {
  const metadataPath = path.join(path.dirname(apkPath), "output-metadata.json");
  if (!existsSync(metadataPath)) {
    return null;
  }
  const raw = JSON.parse(readFileSync(metadataPath, "utf8"));
  const elements = Array.isArray(raw.elements) ? raw.elements : [];
  const apkName = path.basename(apkPath);
  const entry = elements.find((item) => item.outputFile === apkName);
  return entry?.versionName ?? raw.versionName ?? null;
};

const waitForDevice = (adb, timeoutSeconds) => {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const devices = run(adb, ["devices"], { shell: false });
    const lines = devices.stdout
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim())
      .filter((line) => line.endsWith("\tdevice"));
    if (lines.length > 0) {
      return lines[0].split("\t")[0];
    }
    sleepMs(2000);
  }
  throw new Error(`No adb device ready within ${timeoutSeconds}s. Start an emulator or connect hardware.`);
};

const printRecord = ({ outcome, expectedVersion, apkVersion, deviceId, apkPath, notes }) => {
  const runId = process.env.GITHUB_RUN_ID ?? `local-${new Date().toISOString().slice(0, 10)}`;
  console.log("");
  console.log("--- P12 maintainer record (paste into demo matrix) ---");
  console.log(`run_id: ${runId}`);
  console.log(`outcome: ${outcome}`);
  console.log(`expected_version: ${expectedVersion}`);
  console.log(`apk_version_name: ${apkVersion ?? "unknown"}`);
  console.log(`device: ${deviceId ?? "none"}`);
  console.log(`apk: ${path.relative(repoRoot, apkPath)}`);
  if (notes.length > 0) {
    console.log(`notes: ${notes.join("; ")}`);
  }
  console.log("manual_rows: unlock + main shell + one DM/community path (P12 steps 3–4)");
  console.log("------------------------------------------------------");
};

const main = () => {
  const shouldBuild = process.argv.includes("--build");
  const skipInstall = process.argv.includes("--skip-install");
  const waitSeconds = Number(getFlagValue("--wait-device") ?? getArg("--wait-device") ?? "90");
  const explicitApk = getArg("--apk");
  const notes = [];

  console.log("[p12:android-smoke] Step 1/4 — prerequisites");
  const prereq = run("pnpm", ["verify:android-prerequisites"], { cwd: repoRoot, stdio: "inherit" });
  if (!prereq.ok) {
    process.exit(prereq.status);
  }

  const expectedVersion = readExpectedReleaseVersion(repoRoot);

  if (shouldBuild) {
    console.log("[p12:android-smoke] Step 2/4 — emulator debug build (x86_64)");
    const build = run("pnpm", ["build:android:debug:emulator"], { cwd: repoRoot, stdio: "inherit" });
    if (!build.ok) {
      process.exit(build.status);
    }
  } else {
    console.log("[p12:android-smoke] Step 2/4 — using existing APK (pass --build to rebuild)");
  }

  const apkPath = path.resolve(resolveApkPath(explicitApk));
  const apkVersion = readApkVersionName(apkPath);
  console.log(`[p12:android-smoke] APK: ${apkPath}`);
  if (apkVersion && apkVersion !== expectedVersion) {
    notes.push(`apk versionName ${apkVersion} != expected ${expectedVersion} — rebuild with --build`);
    console.warn(`[p12:android-smoke] WARN: APK versionName=${apkVersion}, expected ${expectedVersion}`);
  } else if (apkVersion) {
    console.log(`[p12:android-smoke] APK versionName OK (${apkVersion})`);
  }

  if (skipInstall) {
    printRecord({ outcome: "build_ok", expectedVersion, apkVersion, deviceId: null, apkPath, notes });
    return;
  }

  const adb = resolveAdb();
  if (!adb) {
    notes.push("adb not found — add platform-tools to PATH or set ANDROID_SDK_ROOT");
    printRecord({ outcome: "prereq_ok_no_device", expectedVersion, apkVersion, deviceId: null, apkPath, notes });
    console.error("[p12:android-smoke] adb missing — install platform-tools or set ANDROID_SDK_ROOT.");
    process.exit(1);
  }

  console.log(`[p12:android-smoke] Step 3/4 — waiting for device (timeout ${waitSeconds}s)`);
  const deviceId = waitForDevice(adb, waitSeconds);
  console.log(`[p12:android-smoke] device=${deviceId}`);

  console.log("[p12:android-smoke] Step 4/4 — install + cold start");
  const install = run(adb, ["-s", deviceId, "install", "-r", apkPath], { stdio: "inherit", shell: false });
  if (!install.ok) {
    printRecord({ outcome: "install_failed", expectedVersion, apkVersion, deviceId, apkPath, notes });
    process.exit(install.status);
  }

  const launch = run(adb, ["-s", deviceId, "shell", "am", "start", "-n", MAIN_ACTIVITY], {
    stdio: "inherit",
    shell: false,
  });
  if (!launch.ok) {
    printRecord({ outcome: "launch_failed", expectedVersion, apkVersion, deviceId, apkPath, notes });
    process.exit(launch.status);
  }

  const apiLevel = run(adb, ["-s", deviceId, "shell", "getprop", "ro.build.version.sdk"], { shell: false });
  if (apiLevel.ok) {
    notes.push(`api_level=${apiLevel.stdout}`);
  }

  printRecord({
    outcome: "p12_install_launch_ok",
    expectedVersion,
    apkVersion,
    deviceId,
    apkPath,
    notes,
  });
  console.log("[p12:android-smoke] Complete install + launch. Verify unlock, shell, and one chat path manually.");
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[p12:android-smoke] Failed: ${message}`);
  process.exit(1);
}
