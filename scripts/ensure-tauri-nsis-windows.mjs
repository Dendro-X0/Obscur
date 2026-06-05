#!/usr/bin/env node
/**
 * Prefetch and verify Tauri NSIS toolchain on Windows.
 *
 * Fixes `io: unexpected end of file` when GitHub download of nsis-3.11.zip is
 * truncated (antivirus, proxy, or flaky network). Matches tauri-bundler 2.11:
 * https://github.com/tauri-apps/tauri/blob/dev/crates/tauri-bundler/src/bundle/windows/nsis/mod.rs
 */
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";

const NSIS_URL =
  "https://github.com/tauri-apps/binary-releases/releases/download/nsis-3.11/nsis-3.11.zip";
const NSIS_SHA1 = "ef7ff767e5cbd9edd22add3a32c9b8f4500bb10d";
const NSIS_UTILS_URL =
  "https://github.com/tauri-apps/nsis-tauri-utils/releases/download/nsis_tauri_utils-v0.5.3/nsis_tauri_utils.dll";
const NSIS_UTILS_SHA1 = "75197fee3c6a814fe035788d1c34ead39349b860";

const REQUIRED_FILES = [
  "makensis.exe",
  "Bin/makensis.exe",
  "Stubs/lzma-x86-unicode",
  "Stubs/lzma_solid-x86-unicode",
  "Plugins/x86-unicode/additional/nsis_tauri_utils.dll",
  "Include/MUI2.nsh",
  "Include/FileFunc.nsh",
  "Include/x64.nsh",
  "Include/nsDialogs.nsh",
  "Include/WinMessages.nsh",
  "Include/Win/COM.nsh",
  "Include/Win/Propkey.nsh",
  "Include/Win/RestartManager.nsh",
];

const resolveTauriToolsDir = () => {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    throw new Error("LOCALAPPDATA is not set — cannot resolve Tauri tools directory");
  }
  return join(localAppData, "tauri");
};

const sha1Hex = async (filePath) => {
  const data = await readFile(filePath);
  return createHash("sha1").update(data).digest("hex");
};

const sha1Buffer = (buffer) => createHash("sha1").update(buffer).digest("hex");

const downloadToFile = async (url, destPath, retries = 4) => {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      if (!response.body) {
        throw new Error(`Empty response body for ${url}`);
      }
      await pipeline(Readable.fromWeb(response.body), createWriteStream(destPath));
      return;
    } catch (error) {
      lastError = error;
      try {
        await rm(destPath, { force: true });
      } catch {
        // ignore
      }
      if (attempt < retries) {
        const delayMs = 1500 * attempt;
        console.warn(
          `[ensure-nsis] Download attempt ${attempt} failed (${error instanceof Error ? error.message : error}); retrying in ${delayMs}ms…`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

const extractZipWindows = (zipPath, destDir) => {
  const ps = [
    "-NoProfile",
    "-Command",
    `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
  ];
  const result = spawnSync("powershell.exe", ps, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`Expand-Archive failed (exit ${result.status ?? "unknown"})`);
  }
};

const nsisReady = async (nsisDir) => {
  for (const relative of REQUIRED_FILES) {
    try {
      await stat(join(nsisDir, relative));
    } catch {
      return false;
    }
  }
  const utilsHash = sha1Buffer(await readFile(join(nsisDir, "Plugins/x86-unicode/additional/nsis_tauri_utils.dll")));
  return utilsHash === NSIS_UTILS_SHA1;
};

const installNsis = async (tauriToolsDir, nsisDir) => {
  const tempZip = join(tmpdir(), `nsis-3.11-${Date.now()}.zip`);
  console.log("[ensure-nsis] Downloading NSIS 3.11…");
  await downloadToFile(NSIS_URL, tempZip);
  const zipHash = await sha1Hex(tempZip);
  if (zipHash !== NSIS_SHA1) {
    await rm(tempZip, { force: true });
    throw new Error(
      `NSIS zip SHA1 mismatch (got ${zipHash}, expected ${NSIS_SHA1}). Delete partial cache and retry.`,
    );
  }

  await rm(nsisDir, { recursive: true, force: true });
  const extractedRoot = join(tauriToolsDir, "nsis-3.11");
  await rm(extractedRoot, { recursive: true, force: true });
  await mkdir(tauriToolsDir, { recursive: true });

  console.log("[ensure-nsis] Extracting NSIS…");
  extractZipWindows(tempZip, tauriToolsDir);
  await rm(tempZip, { force: true });

  try {
    await stat(extractedRoot);
  } catch {
    const entries = await readdir(tauriToolsDir);
    throw new Error(
      `Expected extracted folder nsis-3.11 under ${tauriToolsDir}; found: ${entries.join(", ") || "(empty)"}`,
    );
  }

  await rename(extractedRoot, nsisDir);

  const additionalDir = join(nsisDir, "Plugins", "x86-unicode", "additional");
  await mkdir(additionalDir, { recursive: true });

  const utilsPath = join(additionalDir, "nsis_tauri_utils.dll");
  console.log("[ensure-nsis] Downloading nsis_tauri_utils.dll…");
  await downloadToFile(NSIS_UTILS_URL, utilsPath);
  const utilsHash = await sha1Hex(utilsPath);
  if (utilsHash !== NSIS_UTILS_SHA1) {
    await rm(utilsPath, { force: true });
    throw new Error(
      `nsis_tauri_utils.dll SHA1 mismatch (got ${utilsHash}, expected ${NSIS_UTILS_SHA1}). Check antivirus quarantine.`,
    );
  }
};

const main = async () => {
  if (process.platform !== "win32") {
    console.log("[ensure-nsis] Skipped (not Windows).");
    return;
  }

  const tauriToolsDir = resolveTauriToolsDir();
  const nsisDir = join(tauriToolsDir, "NSIS");

  if (await nsisReady(nsisDir)) {
    console.log(`[ensure-nsis] OK — ${nsisDir}`);
    return;
  }

  console.log(`[ensure-nsis] Installing NSIS toolchain to ${nsisDir}…`);
  await installNsis(tauriToolsDir, nsisDir);

  if (!(await nsisReady(nsisDir))) {
    throw new Error(`NSIS install incomplete under ${nsisDir}`);
  }

  console.log(`[ensure-nsis] Ready — ${nsisDir}`);
};

main().catch((error) => {
  console.error(`[ensure-nsis] ${error instanceof Error ? error.message : error}`);
  console.error("");
  console.error("Manual fallback:");
  console.error(`  1. Download ${NSIS_URL}`);
  console.error(`  2. Extract to %LOCALAPPDATA%\\tauri\\ and rename folder to NSIS`);
  console.error(`  3. Download ${NSIS_UTILS_URL}`);
  console.error("     → %LOCALAPPDATA%\\tauri\\NSIS\\Plugins\\x86-unicode\\additional\\nsis_tauri_utils.dll");
  process.exit(1);
});
