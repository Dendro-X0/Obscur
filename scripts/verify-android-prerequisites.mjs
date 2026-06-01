#!/usr/bin/env node
/**
 * Non-destructive checks for Android Studio / Tauri android build prerequisites.
 * Exit 0 when required tools are present; exit 1 with actionable errors otherwise.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { probeJavaMajor, resolveJavaHome } from "./resolve-java-home.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidProjectDir = path.join(repoRoot, "apps/desktop/src-tauri/gen/android");

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    ...options,
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
    status: result.status ?? 1,
  };
};

const errors = [];
const warnings = [];

const resolveNdkHome = (sdkRoot) => {
  const envCandidates = [
    process.env.ANDROID_NDK_HOME,
    process.env.ANDROID_NDK_ROOT,
    process.env.ANDROID_NDK_LATEST_HOME,
    sdkRoot ? path.join(sdkRoot, "ndk-bundle") : null,
  ].filter((value) => typeof value === "string" && value.length > 0);

  for (const candidate of envCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const ndkDir = sdkRoot ? path.join(sdkRoot, "ndk") : null;
  if (ndkDir && existsSync(ndkDir)) {
    const versions = readdirSync(ndkDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const latest = versions.at(-1);
    if (latest) {
      return path.join(ndkDir, latest);
    }
  }

  return null;
};

console.log("[verify:android-prerequisites] Checking Android build environment…");

if (!existsSync(androidProjectDir)) {
  errors.push(
    `Missing ${path.relative(repoRoot, androidProjectDir)} — run \`pnpm -C apps/desktop tauri android init\` once if the project was never generated.`,
  );
}

const javaHomeEnv = process.env.JAVA_HOME;
const resolvedJavaHome = resolveJavaHome();
if (!resolvedJavaHome) {
  errors.push("Java runtime not found. Install JDK 17–24 and set JAVA_HOME to its install directory.");
} else {
  const major = probeJavaMajor(resolvedJavaHome);
  if (major === null || major < 17) {
    errors.push(`JDK 17+ required (resolved: ${resolvedJavaHome}).`);
  } else if (major > 24) {
    errors.push(
      `JDK ${major} cannot run the Android Gradle build. Set JAVA_HOME to JDK 17–24 (e.g. C:\\Program Files\\Java\\jdk-21.0.11).`,
    );
  } else {
    console.log(`[verify:android-prerequisites] Java OK (major=${major}, JAVA_HOME=${resolvedJavaHome})`);
    if (!javaHomeEnv) {
      warnings.push("JAVA_HOME is unset — the Android build script will infer it from PATH, but setting JAVA_HOME explicitly is recommended.");
    } else if (path.normalize(javaHomeEnv) !== path.normalize(resolvedJavaHome)) {
      warnings.push(
        `JAVA_HOME (${javaHomeEnv}) does not match the JDK on PATH (${resolvedJavaHome}). Prefer a single JDK and set JAVA_HOME before building.`,
      );
    }
    const brokenJdk25 = path.normalize("E:/Java/jdk-25.0.2");
    if (javaHomeEnv && path.normalize(javaHomeEnv) === brokenJdk25) {
      errors.push(
        `JAVA_HOME points to a broken JDK 25 install (${javaHomeEnv}). Use JDK 21 instead, e.g. set JAVA_HOME=C:\\Program Files\\Java\\jdk-21.0.11`,
      );
    }
  }
}

const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
if (!sdkRoot || !existsSync(sdkRoot)) {
  errors.push(
    "ANDROID_SDK_ROOT or ANDROID_HOME must point to an installed Android SDK (Android Studio → SDK Manager).",
  );
} else {
  console.log(`[verify:android-prerequisites] Android SDK OK (${sdkRoot})`);
  const platformTools = path.join(sdkRoot, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
  if (existsSync(platformTools)) {
    console.log(`[verify:android-prerequisites] adb OK (${platformTools})`);
  } else {
    warnings.push(`adb not found at ${platformTools} — install Android SDK Platform-Tools.`);
  }
  const platformDir = path.join(sdkRoot, "platforms", "android-36");
  if (!existsSync(platformDir)) {
    warnings.push("Android SDK platform android-36 not found — install via SDK Manager (compileSdk 36).");
  }
  const buildTools = path.join(sdkRoot, "build-tools");
  if (!existsSync(buildTools)) {
    warnings.push("Android SDK build-tools missing.");
  }
  const ndkHome = resolveNdkHome(sdkRoot);
  if (!ndkHome) {
    warnings.push("Android NDK not resolved — install NDK (Side by side) via SDK Manager.");
  } else {
    console.log(`[verify:android-prerequisites] NDK OK (${ndkHome})`);
  }
}

const rustc = run("rustc", ["--version"]);
if (!rustc.ok) {
  errors.push("Rust toolchain not found. Install stable Rust from https://rustup.rs");
} else {
  console.log(`[verify:android-prerequisites] ${rustc.stdout}`);
  const targets = [
    "aarch64-linux-android",
    "armv7-linux-androideabi",
    "i686-linux-android",
    "x86_64-linux-android",
  ];
  const missingTargets = targets.filter((target) => {
    const installed = run("rustup", ["target", "list", "--installed"]);
    return !installed.ok || !installed.stdout.includes(target);
  });
  if (missingTargets.length > 0) {
    warnings.push(
      `Missing Rust Android targets: ${missingTargets.join(", ")}. Install: rustup target add ${missingTargets.join(" ")}`,
    );
  }
}

const tauri = run("pnpm", ["-C", "apps/desktop", "exec", "tauri", "--version"]);
if (!tauri.ok) {
  errors.push("Tauri CLI not available under apps/desktop.");
} else {
  console.log(`[verify:android-prerequisites] Tauri CLI OK (${tauri.stdout})`);
}

for (const warning of warnings) {
  console.warn(`[verify:android-prerequisites] WARN: ${warning}`);
}
for (const error of errors) {
  console.error(`[verify:android-prerequisites] ERROR: ${error}`);
}

if (errors.length > 0) {
  console.error("[verify:android-prerequisites] Failed — fix errors above, then retry.");
  process.exit(1);
}

console.log("[verify:android-prerequisites] Passed (warnings are non-blocking).");
process.exit(0);
