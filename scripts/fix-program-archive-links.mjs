#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const archDir = path.join(repoRoot, "docs/archive/program/inactive-2026-06");
const progDir = path.join(repoRoot, "docs/program");
const archived = new Set(
  fs.readdirSync(archDir).filter((name) => name.endsWith(".md")),
);

for (const file of fs.readdirSync(progDir).filter((name) => name.endsWith(".md"))) {
  const filePath = path.join(progDir, file);
  let text = fs.readFileSync(filePath, "utf8");
  let changed = false;
  for (const name of archived) {
    const from = `](./${name}`;
    const to = `](../archive/program/inactive-2026-06/${name}`;
    if (text.includes(from)) {
      text = text.split(from).join(to);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, text);
    console.log(`updated ${file}`);
  }
}
