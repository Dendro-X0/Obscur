import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  OBSCUR_NOSTR_PRIVATE_SEND,
  OBSCUR_NOSTR_RICH_PORTS,
  PLATFORM_CANONICAL_PORTS,
} from "./port-surfaces";

/**
 * Platform rewrite band P3 — freeze send/list on ProtocolAdaptationLayer.
 */
describe("platform P3 PAL port freeze", () => {
  const featuresRoot = path.resolve(__dirname, "..");
  const protocolRoot = path.resolve(__dirname);

  const collectTsFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry === "dist") {
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

  const isUnderProtocolAdaptation = (file: string): boolean => {
    const rel = path.relative(protocolRoot, file);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  };

  it("publishes frozen port catalogs", () => {
    expect(PLATFORM_CANONICAL_PORTS.length).toBeGreaterThanOrEqual(3);
    expect(OBSCUR_NOSTR_RICH_PORTS.length).toBeGreaterThanOrEqual(3);
    expect(OBSCUR_NOSTR_PRIVATE_SEND).toContain("sendDm");
  });

  it("keeps layer as sole owner of sendDmNostrOnly and adapter routing", () => {
    const layer = readFileSync(path.join(protocolRoot, "layer.ts"), "utf8");
    expect(layer).toContain("sendDmNostrOnly");
    expect(layer).toMatch(/import\s+\{\s*nostrAdapter\s*\}\s+from\s+["']\.\/nostr-adapter["']/);
    expect(layer).toMatch(/import\s+\{\s*matrixAdapter\s*\}\s+from\s+["']\.\/matrix-adapter["']/);
  });

  it("forbids matrix-adapter imports outside protocol-adaptation/", () => {
    const matrixFrom = /from\s+["'][^"']*matrix-adapter["']/;
    const violations: string[] = [];
    for (const file of collectTsFiles(featuresRoot)) {
      if (isUnderProtocolAdaptation(file)) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      const lines = source.split("\n");
      for (let index = 0; index < lines.length; index += 1) {
        if (matrixFrom.test(lines[index] ?? "")) {
          violations.push(`${path.relative(featuresRoot, file)}:${index + 1}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("routes messaging send/delete/retry through layer sendDmNostrOnly", () => {
    const sendRetry = readFileSync(
      path.join(featuresRoot, "messaging/controllers/v2/dm-send-with-retry.ts"),
      "utf8",
    );
    const deletePipeline = readFileSync(
      path.join(featuresRoot, "messaging/controllers/v2/dm-delete-pipeline.ts"),
      "utf8",
    );
    expect(sendRetry).toContain("sendDmNostrOnly");
    expect(sendRetry).not.toMatch(/from\s+["'][^"']*nostr-adapter["']/);
    expect(deletePipeline).toContain("sendDmNostrOnly");
    expect(deletePipeline).not.toMatch(/from\s+["'][^"']*nostr-adapter["']/);
  });

  it("keeps Auth / Profiles / Storage free of adapter leaf imports", () => {
    const planes = ["auth", "auth-kernel", "profiles", "storage"];
    const leafFrom = /from\s+["'][^"']*(nostr-adapter|matrix-adapter)["']/;
    const violations: string[] = [];
    for (const plane of planes) {
      for (const file of collectTsFiles(path.join(featuresRoot, plane))) {
        const source = readFileSync(file, "utf8");
        if (leafFrom.test(source)) {
          violations.push(path.relative(featuresRoot, file).replace(/\\/g, "/"));
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
