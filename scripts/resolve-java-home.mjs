import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const javaExecutableName = process.platform === "win32" ? "java.exe" : "java";

export const parseJavaMajor = (versionOutput) => {
  const quoted = versionOutput.match(/"(\d+)(?:\.(\d+))?/);
  if (quoted) {
    const major = Number(quoted[1]);
    return major === 1 && quoted[2] ? Number(quoted[2]) : major;
  }
  const loose = versionOutput.match(/(\d+)\.(\d+)/);
  if (!loose) {
    return null;
  }
  return Number(loose[1]) === 1 ? Number(loose[2]) : Number(loose[1]);
};

const javaHomeHasExecutable = (javaHome) => (
  typeof javaHome === "string"
  && javaHome.length > 0
  && existsSync(path.join(javaHome, "bin", javaExecutableName))
);

const readJavaHomeFromRuntime = () => {
  const probe = spawnSync("java", ["-XshowSettings:properties", "-version"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (probe.status !== 0) {
    return null;
  }
  const output = `${probe.stderr ?? ""}\n${probe.stdout ?? ""}`;
  const match = output.match(/^\s*java\.home\s*=\s*(.+)$/m);
  return match?.[1]?.trim() ?? null;
};

const normalizeJavaHome = (javaHome) => {
  if (!javaHomeHasExecutable(javaHome)) {
    return null;
  }
  const binDir = path.join(javaHome, "bin");
  const javaPath = path.join(binDir, javaExecutableName);
  const resolvedBin = path.resolve(javaPath, "..");
  return path.resolve(resolvedBin, "..");
};

/** Resolve a Gradle-compatible JAVA_HOME (JDK 17–24 with bin/java). */
export const resolveJavaHome = () => {
  const candidates = [
    process.env.JAVA_HOME,
    readJavaHomeFromRuntime(),
  ].filter((value) => typeof value === "string" && value.length > 0);

  for (const candidate of candidates) {
    const normalized = normalizeJavaHome(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

export const probeJavaMajor = (javaHome) => {
  const javaPath = path.join(javaHome, "bin", javaExecutableName);
  const probe = spawnSync(javaPath, ["-version"], { encoding: "utf8", shell: false });
  if (probe.status !== 0) {
    return null;
  }
  return parseJavaMajor(`${probe.stderr ?? ""}\n${probe.stdout ?? ""}`);
};
