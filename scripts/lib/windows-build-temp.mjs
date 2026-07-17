#!/usr/bin/env node
/**
 * Keep Rust/Tauri intermediate files off a full Windows system drive.
 *
 * rustc writes rmeta under %TEMP%. When C: is near-full (os error 112),
 * point TEMP/TMP at a roomy volume (prefer E:\Temp or the repo drive).
 *
 * Override: OBSCUR_BUILD_TEMP=D:\path
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {{ repoRoot?: string, log?: (msg: string) => void }} [opts]
 * @returns {NodeJS.ProcessEnv}
 */
export function applyWindowsBuildTempEnv(env, opts = {}) {
  if (process.platform !== "win32") {
    return env;
  }

  const log = opts.log ?? (() => {});
  const override = (env.OBSCUR_BUILD_TEMP ?? process.env.OBSCUR_BUILD_TEMP ?? "").trim();
  const candidates = [];

  if (override) {
    candidates.push(override);
  }
  candidates.push("E:\\Temp");
  if (opts.repoRoot) {
    const repoDriveRoot = path.parse(path.resolve(opts.repoRoot)).root;
    if (repoDriveRoot && !/^c:\\$/i.test(repoDriveRoot)) {
      candidates.push(path.join(repoDriveRoot, "obscur-build-temp"));
    }
  }

  for (const candidate of candidates) {
    try {
      mkdirSync(candidate, { recursive: true });
      if (!existsSync(candidate)) {
        continue;
      }
      const next = { ...env, TEMP: candidate, TMP: candidate };
      if (env.TEMP !== candidate || env.TMP !== candidate) {
        log(`TEMP/TMP → ${candidate} (Rust/Tauri intermediates off system drive)`);
      }
      return next;
    } catch {
      // try next candidate
    }
  }

  return env;
}
