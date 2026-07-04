import {
  bootstrapLocaleChunks,
  isDirectRun,
} from "./locale-chunk-lib.mjs";

const parseArgs = () => {
  const locale = process.argv[2]?.trim()?.replace(/\.json$/i, "");
  if (!locale || locale === "en") {
    throw new Error("Usage: node scripts/i18n/bootstrap-locale-chunks.mjs <locale-code>");
  }
  return locale;
};

const run = async () => {
  const localeCode = parseArgs();
  const result = await bootstrapLocaleChunks(localeCode);

  console.log(`Bootstrapped ${localeCode} chunks in ${result.outputDir}`);
  console.log(`  Keys from existing ${localeCode}.json: ${result.totalPresent}`);
  console.log(`  Keys still English (en.json fallback): ${result.totalMissing}`);
  for (const item of result.manifest) {
    console.log(`  ${item.file}: ${item.keys} keys, ${item.lines} lines`);
  }
  console.log("\nTranslate chunk files that still contain English, then run:");
  console.log(`  pnpm i18n:merge-chunks ${localeCode}`);
};

if (isDirectRun(import.meta.url)) {
  run().catch((error) => {
    console.error("Failed to bootstrap locale chunks:", error);
    process.exitCode = 1;
  });
}
