import { promises as fs } from "node:fs";
import path from "node:path";
import ts from "typescript";

const cwd = process.cwd();
const targetArgs = process.argv.slice(2);

if (targetArgs.length === 0) {
  console.error("Usage: node scripts/i18n/remove-inline-fallbacks.mjs <file> [more files]");
  process.exit(1);
}

const isTranslationCall = (node) =>
  ts.isCallExpression(node)
  && ts.isIdentifier(node.expression)
  && node.expression.text === "t"
  && node.arguments.length >= 2
  && ts.isStringLiteralLike(node.arguments[0])
  && ts.isStringLiteralLike(node.arguments[1]);

const transformSource = (sourceText, filePath) => {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  let replacements = 0;

  const transformer = (context) => {
    const visit = (node) => {
      if (isTranslationCall(node)) {
        replacements += 1;
        const nextArgs = [node.arguments[0], ...node.arguments.slice(2)];
        return context.factory.updateCallExpression(node, node.expression, node.typeArguments, nextArgs);
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (node) => ts.visitNode(node, visit);
  };

  const result = ts.transform(sourceFile, [transformer]);
  const transformed = result.transformed[0];
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const nextText = printer.printFile(transformed);
  result.dispose();

  return { nextText, replacements };
};

const run = async () => {
  let totalReplacements = 0;
  for (const relativePath of targetArgs) {
    const absolutePath = path.resolve(cwd, relativePath);
    const original = await fs.readFile(absolutePath, "utf8");
    const { nextText, replacements } = transformSource(original, absolutePath);
    if (replacements > 0 && nextText !== original) {
      await fs.writeFile(absolutePath, nextText, "utf8");
      totalReplacements += replacements;
      console.log(`Updated ${relativePath} (${replacements} replacements).`);
    } else {
      console.log(`No fallback literals found in ${relativePath}.`);
    }
  }
  console.log(`Total replacements: ${totalReplacements}`);
};

run().catch((error) => {
  console.error("Failed to remove inline fallbacks:", error);
  process.exitCode = 1;
});
