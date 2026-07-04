import { promises as fs } from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(process.cwd(), "app");
const EN_LOCALE_PATH = path.resolve(process.cwd(), "app/lib/i18n/locales/en.json");
const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/i;

const decodeFallbackLiteral = (value, quote) => {
  if (quote === "`") {
    return value.replace(/\\`/g, "`").replace(/\\\\/g, "\\");
  }
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, "\"")
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");
};

const collectSourceFiles = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(absolutePath)));
      continue;
    }
    if (entry.isFile() && SOURCE_FILE_PATTERN.test(entry.name)) {
      files.push(absolutePath);
    }
  }
  return files;
};

const extractFallbackPairs = (source) => {
  const pairs = [];
  const regex = /\bt\(\s*(['"`])([^'"`]+)\1\s*,\s*(['"`])((?:\\.|[\s\S])*?)\3\s*[),]/g;
  for (const match of source.matchAll(regex)) {
    const key = match[2]?.trim();
    const quote = match[3];
    const rawFallback = match[4] ?? "";
    if (!key) {
      continue;
    }
    pairs.push({
      key,
      fallback: decodeFallbackLiteral(rawFallback, quote),
    });
  }
  return pairs;
};

const run = async () => {
  const enRaw = await fs.readFile(EN_LOCALE_PATH, "utf8");
  const enLocale = JSON.parse(enRaw);
  const translation = enLocale.translation ?? {};

  const sourceFiles = await collectSourceFiles(APP_ROOT);
  const extracted = new Map();

  for (const filePath of sourceFiles) {
    const content = await fs.readFile(filePath, "utf8");
    const pairs = extractFallbackPairs(content);
    for (const { key, fallback } of pairs) {
      if (!extracted.has(key)) {
        extracted.set(key, fallback);
      }
    }
  }

  let added = 0;
  for (const [key, fallback] of extracted.entries()) {
    if (!(key in translation)) {
      translation[key] = fallback;
      added += 1;
    }
  }

  enLocale.translation = translation;
  await fs.writeFile(EN_LOCALE_PATH, `${JSON.stringify(enLocale, null, 4)}\n`, "utf8");

  console.log(`Scanned ${sourceFiles.length} source files.`);
  console.log(`Found ${extracted.size} translation fallback keys.`);
  console.log(`Added ${added} missing keys to en.json.`);
};

run().catch((error) => {
  console.error("Failed to sync en template:", error);
  process.exitCode = 1;
});
