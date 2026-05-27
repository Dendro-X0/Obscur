#!/usr/bin/env node
/**
 * Tauri android build entry — pins JAVA_HOME + GRADLE_USER_HOME and stops stale Gradle daemons.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { probeJavaMajor, resolveJavaHome } from "../../../scripts/resolve-java-home.mjs";

const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = path.join(desktopDir, "src-tauri/gen/android");
const tauriArgs = process.argv.slice(2);

if (tauriArgs.length === 0) {
  console.error("[run-android-build] Usage: node scripts/run-android-build.mjs <tauri android build args…>");
  process.exit(1);
}

const javaHome = resolveJavaHome();
if (!javaHome) {
  console.error("[run-android-build] Could not resolve JAVA_HOME. Install JDK 17–24 and set JAVA_HOME, then retry.");
  process.exit(1);
}

const javaMajor = probeJavaMajor(javaHome);
if (javaMajor === null || javaMajor < 17 || javaMajor > 24) {
  console.error(
    `[run-android-build] Gradle requires JDK 17–24 (resolved ${javaHome}, major=${javaMajor ?? "unknown"}).`,
  );
  process.exit(1);
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  TAURI_SHELL_TARGET: process.env.TAURI_SHELL_TARGET ?? "mobile",
  GRADLE_USER_HOME: process.env.GRADLE_USER_HOME ?? path.join(homedir(), ".gradle"),
};

const gradleAbiList = process.env.GRADLE_ABI_LIST?.trim();
if (gradleAbiList) {
  env.ORG_GRADLE_PROJECT_abiList = gradleAbiList;
  console.log(`[run-android-build] ORG_GRADLE_PROJECT_abiList=${gradleAbiList}`);
}

console.log(`[run-android-build] JAVA_HOME=${env.JAVA_HOME}`);
console.log(`[run-android-build] GRADLE_USER_HOME=${env.GRADLE_USER_HOME}`);

const gradlew = path.join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
if (existsSync(gradlew)) {
  console.log("[run-android-build] Stopping stale Gradle daemons…");
  spawnSync(gradlew, ["--stop"], { cwd: androidDir, env, stdio: "ignore", shell: true });
}

const result = spawnSync("pnpm", ["exec", "tauri", "android", "build", ...tauriArgs], {
  cwd: desktopDir,
  env,
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
