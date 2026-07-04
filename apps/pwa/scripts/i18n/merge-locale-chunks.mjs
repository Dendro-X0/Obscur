import { promises as fs } from "node:fs";
import path from "node:path";

const LOCALES_DIR = path.resolve(process.cwd(), "app/lib/i18n/locales");
const CHUNKS_DIR = path.join(LOCALES_DIR, "chunks");
const TEMPLATE = "en.json";

const chunkFilePattern = /^([a-z]{2})\.chunk-\d+-of-\d+\.json$/i;

const parseArgs = () => {
  const locale = process.argv[2]?.trim();
  if (!locale) {
    throw new Error("Usage: node scripts/i18n/merge-locale-chunks.mjs <locale-code>");
  }
  return locale.replace(/\.json$/i, "");
};

const run = async () => {
  const localeCode = parseArgs();
  const chunkDir = path.join(CHUNKS_DIR, localeCode);
  const outputPath = path.join(LOCALES_DIR, `${localeCode}.json`);
  const templatePath = path.join(LOCALES_DIR, TEMPLATE);

  const template = JSON.parse(await fs.readFile(templatePath, "utf8"));
  const templateKeys = Object.keys(template.translation ?? template);

  const chunkFiles = (await fs.readdir(chunkDir))
    .filter((name) => chunkFilePattern.test(name))
    .sort((left, right) => left.localeCompare(right));

  if (chunkFiles.length === 0) {
    throw new Error(`No chunk files found in ${chunkDir}`);
  }

  const merged = {};
  for (const fileName of chunkFiles) {
    const parsed = JSON.parse(await fs.readFile(path.join(chunkDir, fileName), "utf8"));
    const translation = parsed.translation ?? parsed;
    for (const [key, value] of Object.entries(translation)) {
      if (key in merged) {
        throw new Error(`Duplicate key "${key}" in ${fileName}`);
      }
      merged[key] = value;
    }
  }

  const mergedKeys = Object.keys(merged);
  const missingFromTemplate = templateKeys.filter((key) => !(key in merged));
  const extraKeys = mergedKeys.filter((key) => !templateKeys.includes(key));

  await fs.writeFile(
    outputPath,
    `${JSON.stringify({ translation: merged }, null, 4)}\n`,
    "utf8",
  );

  console.log(`Merged ${chunkFiles.length} chunks into ${path.relative(process.cwd(), outputPath)}`);
  console.log(`  Keys merged: ${mergedKeys.length}`);
  console.log(`  Template keys: ${templateKeys.length}`);
  console.log(`  Missing vs ${TEMPLATE}: ${missingFromTemplate.length}`);
  console.log(`  Extra vs ${TEMPLATE}: ${extraKeys.length}`);

  if (missingFromTemplate.length > 0) {
    console.log("\nFirst missing keys:");
    for (const key of missingFromTemplate.slice(0, 20)) {
      console.log(`  ${key}`);
    }
    if (missingFromTemplate.length > 20) {
      console.log(`  ... and ${missingFromTemplate.length - 20} more`);
    }
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error("Failed to merge locale chunks:", error);
  process.exitCode = 1;
});
