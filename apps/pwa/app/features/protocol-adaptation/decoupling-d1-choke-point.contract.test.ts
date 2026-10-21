import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Slice D1 — only the Nostr adapter may value-import kernel list/send ports.
 * Type-only imports and the port modules themselves stay allowed.
 */
describe("decoupling D1 choke point", () => {
  const appRoot = path.resolve(__dirname, "../..");

  const collectTsFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules") {
          continue;
        }
        out.push(...collectTsFiles(full));
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry) && !entry.includes(".test.") && !entry.includes(".spec.")) {
        out.push(full);
      }
    }
    return out;
  };

  const forbiddenValueImport = /from\s+["'][^"']*(?:dm-send-pipeline|dm-kernel-sidebar-port|dm-kernel-thread-port)["']/;

  const allowedBasenames = new Set([
    "nostr-adapter.ts",
    "dm-send-pipeline.ts",
    "dm-kernel-sidebar-port.ts",
    "dm-kernel-thread-port.ts",
  ]);

  it("keeps value imports of send/list ports inside the Nostr adapter", () => {
    const violations: string[] = [];
    for (const file of collectTsFiles(appRoot)) {
      if (allowedBasenames.has(path.basename(file))) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      const lines = source.split("\n");
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        if (!forbiddenValueImport.test(line)) {
          continue;
        }
        const window = lines.slice(Math.max(0, index - 6), index + 1).join("\n");
        const importStart = window.lastIndexOf("import ");
        const statement = importStart >= 0 ? window.slice(importStart) : line;
        if (/^import\s+type\b/.test(statement.trim())) {
          continue;
        }
        violations.push(`${path.relative(appRoot, file)}:${index + 1}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("routes delete and retry sends through nostrAdapter", () => {
    const deletePipeline = readFileSync(
      path.join(appRoot, "features/messaging/controllers/v2/dm-delete-pipeline.ts"),
      "utf8",
    );
    const retry = readFileSync(
      path.join(appRoot, "features/messaging/controllers/v2/dm-send-with-retry.ts"),
      "utf8",
    );
    expect(deletePipeline).toContain("nostrAdapter.sendDm");
    expect(retry).toContain("nostrAdapter.sendDm");
    expect(deletePipeline).not.toContain("dm-send-pipeline");
    expect(retry).not.toContain("dm-send-pipeline");
  });

  it("keeps the Nostr adapter implementation under protocol-adaptation/nostr", () => {
    const shim = readFileSync(path.join(__dirname, "nostr-adapter.ts"), "utf8");
    const implementation = readFileSync(path.join(__dirname, "nostr/nostr-adapter.ts"), "utf8");
    expect(shim).toContain('from "./nostr/nostr-adapter"');
    expect(implementation).toContain("loadDmKernelSidebar");
    expect(implementation).toContain("sendDmPipeline");
  });
});
