import {
  bootstrapLocaleChunks,
  DEFAULT_MAX_LINES,
  isDirectRun,
  splitLocaleFile,
  SUPPORTED_LOCALES,
} from "./locale-chunk-lib.mjs";

const parseArgs = () => {
  const args = process.argv.slice(2);
  let maxLines = DEFAULT_MAX_LINES;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--max-lines") {
      maxLines = Number.parseInt(args[index + 1] ?? "", 10);
      index += 1;
    }
  }

  if (!Number.isFinite(maxLines) || maxLines < 20) {
    throw new Error(`--max-lines must be a positive integer (default ${DEFAULT_MAX_LINES}).`);
  }

  return { maxLines };
};

const run = async () => {
  const { maxLines } = parseArgs();

  console.log(`Preparing locale chunks (max ${maxLines} lines per file)\n`);

  const enResult = await splitLocaleFile({ maxLines });
  console.log(`[en] ${enResult.keyCount} keys → ${enResult.manifest.length} chunks`);
  for (const item of enResult.manifest) {
    console.log(`  ${item.file}: ${item.keys} keys, ${item.lines} lines`);
  }

  for (const localeCode of SUPPORTED_LOCALES.filter((code) => code !== "en")) {
    const result = await bootstrapLocaleChunks(localeCode);
    console.log(`\n[${localeCode}] ${result.totalPresent} translated, ${result.totalMissing} English fallback`);
    for (const item of result.manifest) {
      console.log(`  ${item.file}: ${item.keys} keys, ${item.lines} lines`);
    }
  }

  console.log("\nChunk folders:");
  for (const localeCode of SUPPORTED_LOCALES) {
    console.log(`  app/lib/i18n/locales/chunks/${localeCode}/`);
  }
  console.log("\nAfter translating, merge each locale:");
  console.log("  pnpm i18n:merge-chunks es");
  console.log("  pnpm i18n:merge-chunks zh");
  console.log("  pnpm i18n:merge-chunks fr");
  console.log("  pnpm i18n:merge-chunks de");
};

if (isDirectRun(import.meta.url)) {
  run().catch((error) => {
    console.error("Failed to prepare locale chunks:", error);
    process.exitCode = 1;
  });
}
