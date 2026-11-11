import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Cut 3.3 — Vite private-trust home must not reintroduce chat-state / mega-provider authority.
 * @see specs/backend/cut3-ui-vite-thin-shell-design-2026-11-09.md
 */

const SRC_ROOT = join(fileURLToPath(new URL(".", import.meta.url)));

const FORBIDDEN_PATTERNS: ReadonlyArray<Readonly<{ id: string; re: RegExp }>> = [
  { id: "MessagingProvider", re: /\bMessagingProvider\b/ },
  { id: "chat-state store", re: /\bchat-state-store\b|\bPersistedChatState\b/ },
  { id: "dm_message_queue_v1", re: /dm_message_queue_v1/ },
  { id: "MessageQueue localStorage", re: /\bMessageQueue\b/ },
  { id: "apps/pwa feature import", re: /from\s+["'][^"']*apps\/pwa\// },
  { id: "pwa @/app feature deep import", re: /from\s+["']@\/app\/features\// },
];

const collectSourceFiles = (dir: string, acc: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") {
        continue;
      }
      collectSourceFiles(full, acc);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry) && !/\.contract\.test\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
};

describe("Cut 3.3 private-trust home import boundary", () => {
  it("keeps Vite tree free of chat-state / Next messaging authority", () => {
    const sources = collectSourceFiles(SRC_ROOT);
    const offenders: string[] = [];
    for (const file of sources) {
      const rel = relative(SRC_ROOT, file).replace(/\\/g, "/");
      const source = readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.re.test(source)) {
          offenders.push(`${rel} · ${pattern.id}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("wires private-trust home through @obscur/private-trust-engine face policy", () => {
    const home = readFileSync(join(SRC_ROOT, "private-trust/PrivateTrustHome.tsx"), "utf8");
    const lab = readFileSync(join(SRC_ROOT, "private-trust/lab-private-trust-ports.ts"), "utf8");
    expect(home).toContain("@obscur/private-trust-engine");
    expect(home).toContain("privateTrustComposeTransportCopy");
    expect(lab).toContain("guardPrivateTrustSendFace");
    expect(lab).toContain("resolveActiveProtocolIdFromEvidence");
  });

  it("Cut 4.2 native ports use HostEnginePort + package T3 helpers without pwa import", () => {
    const native = readFileSync(join(SRC_ROOT, "private-trust/native-private-trust-ports.ts"), "utf8");
    expect(native).toContain("@obscur/engine-contracts");
    expect(native).toContain("@obscur/private-trust-engine");
    expect(native).toContain("sendPrivateTrustT3ViaHost");
    expect(native).toContain("listPrivateTrustConversationsViaHost");
    expect(native).toContain("guardPrivateTrustSendFace");
    expect(native).not.toMatch(/from\s+["'][^"']*apps\/pwa\//);
    expect(native).not.toMatch(/from\s+["']@\/app\/features\//);
  });
});
