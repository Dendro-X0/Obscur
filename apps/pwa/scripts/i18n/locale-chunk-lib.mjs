import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LOCALES_DIR = path.resolve(process.cwd(), "app/lib/i18n/locales");
export const CHUNKS_DIR = path.join(LOCALES_DIR, "chunks");
export const SUPPORTED_LOCALES = ["en", "es", "zh", "fr", "de"];
export const DEFAULT_MAX_LINES = 1200;
export const TEMPLATE_FILE = "en.json";

export const formatChunk = (entries) => (
  `${JSON.stringify({ translation: Object.fromEntries(entries) }, null, 4)}\n`
);

export const countLines = (text) => text.split("\n").length;

export const readTranslation = async (fileName) => {
  const parsed = JSON.parse(await fs.readFile(path.join(LOCALES_DIR, fileName), "utf8"));
  return parsed.translation ?? parsed;
};

export const splitTranslationIntoChunks = (entries, maxLines) => {
  const chunks = [];
  let current = [];

  for (const entry of entries) {
    const candidate = [...current, entry];
    const candidateText = formatChunk(candidate);
    if (current.length > 0 && countLines(candidateText) > maxLines) {
      chunks.push(current);
      current = [entry];
      continue;
    }
    current = candidate;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
};

export const writeLocaleChunks = async ({
  localeCode,
  chunks,
  maxLines,
}) => {
  const outputDir = path.join(CHUNKS_DIR, localeCode);
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  const pad = String(chunks.length).length;
  const manifest = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunkNumber = String(index + 1).padStart(pad, "0");
    const fileName = `${localeCode}.chunk-${chunkNumber}-of-${String(chunks.length).padStart(pad, "0")}.json`;
    const text = formatChunk(chunks[index]);
    await fs.writeFile(path.join(outputDir, fileName), text, "utf8");
    manifest.push({
      file: fileName,
      keys: chunks[index].length,
      lines: countLines(text),
    });
  }

  return { outputDir, manifest, chunkCount: chunks.length, pad };
};

export const splitLocaleFile = async ({
  source = TEMPLATE_FILE,
  maxLines = DEFAULT_MAX_LINES,
}) => {
  const localeCode = source.replace(/\.json$/i, "");
  const raw = await fs.readFile(path.join(LOCALES_DIR, source), "utf8");
  const translation = await readTranslation(source);
  const entries = Object.entries(translation);
  const chunks = splitTranslationIntoChunks(entries, maxLines);
  const { outputDir, manifest } = await writeLocaleChunks({ localeCode, chunks, maxLines });

  return {
    localeCode,
    source,
    keyCount: entries.length,
    sourceLines: countLines(raw),
    maxLines,
    outputDir,
    manifest,
  };
};

const enChunkFilePattern = /^en\.chunk-(\d+)-of-(\d+)\.json$/i;

export const bootstrapLocaleChunks = async (localeCode) => {
  if (localeCode === "en") {
    throw new Error("Use splitLocaleFile for en; bootstrap is for translated locales only.");
  }

  const localeTranslation = await readTranslation(`${localeCode}.json`);
  const templateTranslation = await readTranslation(TEMPLATE_FILE);
  const enChunkDir = path.join(CHUNKS_DIR, "en");
  const outputDir = path.join(CHUNKS_DIR, localeCode);

  const enChunkFiles = (await fs.readdir(enChunkDir))
    .filter((name) => enChunkFilePattern.test(name))
    .sort((left, right) => left.localeCompare(right));

  if (enChunkFiles.length === 0) {
    throw new Error(`Missing ${enChunkDir}. Run split on en.json first.`);
  }

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  let totalPresent = 0;
  let totalMissing = 0;
  const manifest = [];

  for (const enChunkName of enChunkFiles) {
    const match = enChunkName.match(enChunkFilePattern);
    const chunkNumber = match?.[1] ?? "1";
    const chunkTotal = match?.[2] ?? String(enChunkFiles.length);
    const enChunk = JSON.parse(await fs.readFile(path.join(enChunkDir, enChunkName), "utf8")).translation;
    const outName = `${localeCode}.chunk-${chunkNumber}-of-${chunkTotal}.json`;
    const entries = [];

    for (const key of Object.keys(enChunk)) {
      if (key in localeTranslation) {
        entries.push([key, localeTranslation[key]]);
        totalPresent += 1;
      } else if (key in templateTranslation) {
        entries.push([key, templateTranslation[key]]);
        totalMissing += 1;
      } else {
        entries.push([key, enChunk[key]]);
        totalMissing += 1;
      }
    }

    const text = formatChunk(entries);
    await fs.writeFile(path.join(outputDir, outName), text, "utf8");
    manifest.push({
      file: outName,
      keys: entries.length,
      lines: countLines(text),
    });
  }

  return {
    localeCode,
    outputDir,
    manifest,
    totalPresent,
    totalMissing,
  };
};

export const isDirectRun = (importMetaUrl) => (
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(importMetaUrl)
);
