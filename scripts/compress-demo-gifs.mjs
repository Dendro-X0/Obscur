#!/usr/bin/env node
/**
 * Compress demo GIFs into web-friendly MP4 (+ optional poster) under docs/assets/gifs/web/.
 *
 * Usage:
 *   node scripts/compress-demo-gifs.mjs --report
 *   node scripts/compress-demo-gifs.mjs --all
 *   node scripts/compress-demo-gifs.mjs --only preview_files_1.gif
 *
 * Prefers system `ffmpeg`, then `ffmpeg-static` if installed:
 *   pnpm add -Dw ffmpeg-static
 *
 * Targets: 720p max, ~10 fps, CRF 30, no audio. Soft budget 1.5 MB; hard fail > 3 MB unless --force.
 */

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const gifDir = path.join(repoRoot, "docs", "assets", "gifs");
const webDir = path.join(gifDir, "web");

const SOFT_BYTES = 1.5 * 1024 * 1024;
const HARD_BYTES = 3 * 1024 * 1024;

const argv = process.argv.slice(2);
const args = new Set(argv);
const reportOnly = args.has("--report");
const force = args.has("--force");
const onlyIdx = argv.indexOf("--only");
const onlyArg =
  onlyIdx >= 0
    ? argv[onlyIdx + 1]
    : argv.find((a) => a.startsWith("--only="))?.slice("--only=".length) ?? null;
const runAll = args.has("--all") || Boolean(onlyArg);

function mb(n) {
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function listArchiveGifs() {
  return readdirSync(gifDir)
    .filter((name) => /\.gif$/i.test(name) && !/\.gif\.gif$/i.test(name))
    .filter((name) => statSync(path.join(gifDir, name)).isFile())
    .sort((a, b) => a.localeCompare(b));
}

function resolveFfmpeg() {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  const which = spawnSync(process.platform === "win32" ? "where" : "which", ["ffmpeg"], {
    encoding: "utf8",
  });
  if (which.status === 0) {
    const line = which.stdout.trim().split(/\r?\n/).find(Boolean);
    if (line) return line;
  }
  for (const id of ["@ffmpeg-installer/ffmpeg", "ffmpeg-static"]) {
    try {
      if (id === "@ffmpeg-installer/ffmpeg") {
        const mod = require("@ffmpeg-installer/ffmpeg");
        if (mod?.path && existsSync(mod.path)) return mod.path;
      } else {
        const bin = require("ffmpeg-static");
        if (bin && existsSync(bin)) return bin;
      }
    } catch {
      /* optional */
    }
  }
  return null;
}

function stemOf(gifName) {
  return gifName.replace(/\.gif$/i, "");
}

function printReport() {
  const gifs = listArchiveGifs();
  let total = 0;
  console.log("Archive GIFs (docs/assets/gifs/):\n");
  console.log(`${"MB".padStart(8)}  ${"web mp4".padEnd(10)}  name`);
  for (const name of gifs) {
    const size = statSync(path.join(gifDir, name)).size;
    total += size;
    const stem = stemOf(name);
    const mp4 = path.join(webDir, `${stem}.mp4`);
    const webOk = existsSync(mp4) ? mb(statSync(mp4).size) : "-";
    console.log(`${mb(size).padStart(8)}  ${String(webOk).padEnd(10)}  ${name}`);
  }
  console.log(`\nArchive total: ${mb(total)} · ${gifs.length} files`);
  if (existsSync(webDir)) {
    const webs = readdirSync(webDir).filter((n) => n.endsWith(".mp4"));
    let wtotal = 0;
    for (const n of webs) wtotal += statSync(path.join(webDir, n)).size;
    console.log(
      `Web MP4 total: ${mb(wtotal)} · ${webs.length} files (soft ${mb(SOFT_BYTES)} / hard ${mb(HARD_BYTES)})`,
    );
  }
}

function compressOne(ffmpegBin, gifName) {
  mkdirSync(webDir, { recursive: true });
  const input = path.join(gifDir, gifName);
  const stem = stemOf(gifName);
  const outMp4 = path.join(webDir, `${stem}.mp4`);
  const tmpMp4 = path.join(webDir, `${stem}.tmp.mp4`);
  const outPoster = path.join(webDir, `${stem}.poster.jpg`);

  const encode = spawnSync(
    ffmpegBin,
    [
      "-y",
      "-i",
      input,
      "-an",
      "-vf",
      "scale='min(1280,iw)':-2:flags=lanczos,fps=10",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-profile:v",
      "main",
      "-crf",
      "30",
      "-movflags",
      "+faststart",
      "-f",
      "mp4",
      tmpMp4,
    ],
    { encoding: "utf8" },
  );
  if (encode.status !== 0) {
    console.error(encode.stderr || encode.stdout);
    throw new Error(`ffmpeg failed for ${gifName}`);
  }
  renameSync(tmpMp4, outMp4);
  const size = statSync(outMp4).size;
  if (size > HARD_BYTES && !force) {
    throw new Error(
      `${gifName} → ${mb(size)} exceeds hard budget ${mb(HARD_BYTES)} (re-run with --force or raise CRF)`,
    );
  }

  spawnSync(
    ffmpegBin,
    ["-y", "-i", input, "-frames:v", "1", "-vf", "scale='min(960,iw)':-2", outPoster],
    { encoding: "utf8" },
  );

  // Mirror into website public for local / Vercel file serving without waiting on GitHub raw.
  const publicDir = path.join(repoRoot, "apps", "website", "public", "guide-media");
  mkdirSync(publicDir, { recursive: true });
  const publicMp4 = path.join(publicDir, `${stem}.mp4`);
  const publicPoster = path.join(publicDir, `${stem}.poster.jpg`);
  copyFileSync(outMp4, publicMp4);
  if (existsSync(outPoster)) {
    copyFileSync(outPoster, publicPoster);
  }

  const flag = size > SOFT_BYTES ? "SOFT_OVER" : "ok";
  console.log(`${flag.padEnd(10)} ${gifName} → web/${stem}.mp4 (${mb(size)})`);
}

function renameDoubleExtensions() {
  for (const name of readdirSync(gifDir)) {
    if (!/\.gif\.gif$/i.test(name)) continue;
    const target = name.replace(/\.gif\.gif$/i, ".gif");
    const from = path.join(gifDir, name);
    const to = path.join(gifDir, target);
    if (existsSync(to)) {
      console.warn(`skip rename (exists): ${target}`);
      continue;
    }
    renameSync(from, to);
    console.log(`renamed ${name} → ${target}`);
  }
}

function main() {
  renameDoubleExtensions();

  if (reportOnly || (!runAll && !args.has("--all"))) {
    printReport();
    if (!reportOnly) {
      console.log("\nPass --all to compress, or --only <file.gif>");
    }
    return;
  }

  const ffmpegBin = resolveFfmpeg();
  if (!ffmpegBin) {
    console.error(
      [
        "ffmpeg not found.",
        "Install system ffmpeg, or: pnpm add -Dw @ffmpeg-installer/ffmpeg",
        "Or set FFMPEG_PATH. Then: node scripts/compress-demo-gifs.mjs --all",
      ].join("\n"),
    );
    process.exit(2);
  }
  console.log(`ffmpeg: ${ffmpegBin}`);

  let targets = listArchiveGifs();
  if (onlyArg) {
    targets = targets.filter((n) => n === onlyArg || n === path.basename(onlyArg));
    if (targets.length === 0) {
      console.error(`No match for --only ${onlyArg}`);
      process.exit(1);
    }
  }

  for (const name of targets) {
    compressOne(ffmpegBin, name);
  }
  printReport();
}

main();
