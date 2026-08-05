import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_APP_ROOT = join(REPO_ROOT, "apps/pwa/app");

const W25_LEGACY_TARGETS = [
  "native-dm-conversation-hydrate-owner-legacy",
  "dm-read-authority-contract-legacy",
  "dm-conversation-hydrate-read-model-legacy",
  "dm-conversation-hydrate-indexed-scan-legacy",
  "dm-conversation-hydrate-indexed-map-rows-legacy",
] as const;

const isLegacyPortFile = (relativePath: string): boolean => (
  /-port\.(ts|tsx)$/.test(relativePath)
  || relativePath.endsWith("messaging-chat-state-ui-mirror.ts")
);

const collectFeatureSources = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "legacy") {
        continue;
      }
      collectFeatureSources(full, acc);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.(ts|tsx)$/.test(entry)) {
      continue;
    }
    acc.push(full);
  }
  return acc;
};

describe("legacy subtraction w25 — hydrate stack zero direct importers", () => {
  it("features production sources import w25 legacy targets only through ports", () => {
    const featuresRoot = join(PWA_APP_ROOT, "features");
    if (!existsSync(featuresRoot)) {
      throw new Error("features root missing");
    }

    const offenders: string[] = [];
    for (const file of collectFeatureSources(featuresRoot)) {
      const rel = relative(PWA_APP_ROOT, file).replace(/\\/g, "/");
      if (isLegacyPortFile(rel)) {
        continue;
      }
      const source = readFileSync(file, "utf8");
      for (const target of W25_LEGACY_TARGETS) {
        if (source.includes(target)) {
          offenders.push(`${rel} → ${target}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("native-dm hydrate refuse port deleted (Wave 4); thick hydrate helpers gone", () => {
    expect(existsSync(join(PWA_APP_ROOT, "features/messaging/services/native-dm-conversation-hydrate-port.ts"))).toBe(false);
    expect(existsSync(join(PWA_APP_ROOT, "features/messaging/services/native-dm-conversation-hydrate-owner.ts"))).toBe(false);
    const readAuthorityPort = readFileSync(
      join(PWA_APP_ROOT, "features/messaging/services/dm-read-authority-port.ts"),
      "utf8",
    );
    expect(readAuthorityPort).toContain("./dm-read-authority-contract");
    expect(existsSync(join(PWA_APP_ROOT, "features/messaging/services/thread-history/dm-thread-history-legacy-port.ts"))).toBe(false);
    expect(existsSync(join(PWA_APP_ROOT, "features/messaging/services/thread-history/hydrate-indexed-legacy-port.ts"))).toBe(false);
  });

  it("use-thread-messages is dm-kernel or inert only", () => {
    const threadMessages = readFileSync(
      join(PWA_APP_ROOT, "features/messaging/hooks/use-thread-messages.ts"),
      "utf8",
    );
    expect(threadMessages).toContain("useDmKernelThread");
    expect(threadMessages).toContain("isDmKernelAuthority");
    expect(threadMessages).not.toContain("conversation-messages-legacy-port");
    expect(threadMessages).not.toContain("native-dm-conversation-hydrate-owner-legacy");
  });
});
