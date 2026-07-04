import {
  DEFAULT_MAX_LINES,
  isDirectRun,
  splitLocaleFile,
} from "./locale-chunk-lib.mjs";

const parseArgs = () => {
  const args = process.argv.slice(2);
  let maxLines = DEFAULT_MAX_LINES;
  let source = "en.json";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--max-lines") {
      maxLines = Number.parseInt(args[index + 1] ?? "", 10);
      index += 1;
      continue;
    }
    if (arg === "--source") {
      source = args[index + 1] ?? "en.json";
      index += 1;
    }
  }

  if (!Number.isFinite(maxLines) || maxLines < 20) {
    throw new Error(`--max-lines must be a positive integer (default ${DEFAULT_MAX_LINES}).`);
  }

  return { maxLines, source };
};

const run = async () => {
  const { maxLines, source } = parseArgs();
  const result = await splitLocaleFile({ source, maxLines });

  console.log(`Split ${result.source} (${result.keyCount} keys, ${result.sourceLines} lines)`);
  console.log(`Max lines per chunk: ${result.maxLines}`);
  console.log(`Output: ${result.outputDir}`);
  for (const item of result.manifest) {
    console.log(`  ${item.file}: ${item.keys} keys, ${item.lines} lines`);
  }
};

if (isDirectRun(import.meta.url)) {
  run().catch((error) => {
    console.error("Failed to split locale chunks:", error);
    process.exitCode = 1;
  });
}
