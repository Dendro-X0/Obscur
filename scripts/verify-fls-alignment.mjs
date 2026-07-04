#!/usr/bin/env node
/**
 * Obscur FLS alignment gate — static scan for navigation UX-gate violations (INV-COMM-001, INV-COMM-007).
 * Pairs with CodaCtrl FLS0 engine; runs in-repo without codactrld.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rulePackPath = path.join(root, ".codactrl/logic/obscur-fls-rule-pack-v1.json");

const NAVIGATION_GATE_RULES = ["RG-NO-UX-GATE-LOCAL-KEY", "RG-PROBE-PESSIMISM"];

/** Charter-deferred — join/crypto hard-fail; not navigation gates. */
const DEFERRED_RULES = new Set(["RG-GATE-HARD-RETURN-KEY"]);

function globMatches(pattern, relPath) {
  let regex = "^";
  for (const ch of pattern) {
    if (ch === "*") {
      regex += regex.endsWith("*") ? ".*" : "[^/]*";
    } else if (".+^$|()[]{}\\".includes(ch)) {
      regex += `\\${ch}`;
    } else {
      regex += ch;
    }
  }
  regex = regex.replace("/**/", "(/.+)?/").replace(/\*\*/g, ".*");
  return new RegExp(`${regex}$`).test(relPath.replace(/\\/g, "/"));
}

function inScope(relPath, rule) {
  if (rule.excludeGlobs?.some((g) => globMatches(g, relPath))) {
    return false;
  }
  if (!rule.scopeGlobs?.length) {
    return true;
  }
  return rule.scopeGlobs.some((g) => globMatches(g, relPath));
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "out") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function hasException(content, relPath, exceptions) {
  return exceptions?.some((ex) => relPath.includes(ex) || content.includes(ex)) ?? false;
}

function main() {
  if (!fs.existsSync(rulePackPath)) {
    console.error(`[verify:fls-alignment] missing ${rulePackPath}`);
    process.exit(1);
  }
  const pack = JSON.parse(fs.readFileSync(rulePackPath, "utf8"));
  const rules = (pack.staticRules ?? []).filter(
    (r) => NAVIGATION_GATE_RULES.includes(r.id) && r.detector === "regex",
  );
  if (rules.length === 0) {
    console.error("[verify:fls-alignment] no navigation gate rules in pack");
    process.exit(1);
  }

  const findings = [];
  const scanRoot = path.join(root, "apps/pwa");
  for (const file of walk(scanRoot)) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");
    for (const rule of rules) {
      if (!inScope(rel, rule)) {
        continue;
      }
      if (hasException(content, rel, rule.exceptions)) {
        continue;
      }
      for (const expr of rule.expressions ?? []) {
        const re = new RegExp(expr);
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (re.test(line)) {
            findings.push({
              ruleId: rule.id,
              file: rel,
              line: i + 1,
              matched: line.trim().slice(0, 120),
            });
          }
        }
      }
    }
  }

  const deferred = (pack.staticRules ?? []).filter((r) => DEFERRED_RULES.has(r.id));
  let deferredCount = 0;
  for (const rule of deferred) {
    for (const file of walk(scanRoot)) {
      const rel = path.relative(root, file).replace(/\\/g, "/");
      if (!inScope(rel, rule)) {
        continue;
      }
      const content = fs.readFileSync(file, "utf8");
      for (const expr of rule.expressions ?? []) {
        if (new RegExp(expr).test(content)) {
          deferredCount += 1;
        }
      }
    }
  }

  const outDir = path.join(root, ".codectx/logic");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "findings.v1.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        schemaVersion: "codactrl.functional.logic.findings@1.0.0",
        rulePackId: pack.rulePackId,
        workspaceRoot: root.replace(/\\/g, "/"),
        evaluatedAt: new Date().toISOString(),
        navigationGateFindings: findings,
        violatedCount: findings.length,
        deferredRuleHits: deferredCount,
      },
      null,
      2,
    ),
  );

  console.log(`[verify:fls-alignment] navigation gate violations: ${findings.length}`);
  console.log(`[verify:fls-alignment] deferred charter rules (informational): ${deferredCount}`);
  if (findings.length > 0) {
    for (const f of findings.slice(0, 20)) {
      console.error(`  ${f.ruleId} ${f.file}:${f.line}  ${f.matched}`);
    }
    if (findings.length > 20) {
      console.error(`  ... and ${findings.length - 20} more`);
    }
    console.error(`[verify:fls-alignment] FAIL — see ${outPath}`);
    process.exit(1);
  }
  console.log(`[verify:fls-alignment] PASS — wrote ${outPath}`);
}

main();
