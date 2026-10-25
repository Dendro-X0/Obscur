import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * C0 Phase 0 exit contract — messaging UI must not call Nostr relay send/list
 * APIs directly; send/list go through ProtocolAdaptationLayer.
 */
describe("protocol adaptation UI boundary (C0)", () => {
  const pwaRoot = path.resolve(__dirname, "../..");
  const featuresRoot = path.join(pwaRoot, "features");

  const collectTsFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        if (entry === "node_modules" || entry === "__tests__") {
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

  /** Send/list owners — UI must use protocol-adaptation, not these ports. */
  const forbiddenImportPatterns = [
    /from\s+["'][^"']*dm-send-pipeline["']/,
    /from\s+["'][^"']*dm-kernel-sidebar-port["']/,
    /from\s+["'][^"']*dm-kernel-thread-port["']/,
    /from\s+["']@dweb\/transport-contracts/,
  ] as const;

  it("keeps façade + NostrAdapter as the send/list owners", () => {
    const layer = readFileSync(path.join(__dirname, "layer.ts"), "utf8");
    const adapter = readFileSync(path.join(__dirname, "nostr/nostr-adapter.ts"), "utf8");
    expect(layer).toContain("ProtocolAdaptationLayer");
    expect(layer).toContain("listDmConversations");
    expect(layer).toContain("listDmMessages");
    expect(layer).toContain("sendDm");
    expect(adapter).toContain("loadDmKernelSidebar");
    expect(adapter).toContain("loadDmKernelThread");
    expect(adapter).toContain("sendDmPipeline");
    expect(adapter).not.toContain("matrix");
  });

  it("routes messaging provider send/list consumers through protocol-adaptation", () => {
    const provider = readFileSync(
      path.join(featuresRoot, "messaging/providers/messaging-provider.tsx"),
      "utf8",
    );
    const controller = readFileSync(
      path.join(featuresRoot, "messaging/controllers/v2/dm-controller.ts"),
      "utf8",
    );
    const threadHook = readFileSync(
      path.join(featuresRoot, "dm-kernel/use-dm-kernel-thread.ts"),
      "utf8",
    );

    expect(provider).toContain("@/app/features/protocol-adaptation/layer");
    expect(provider).toContain("listDmConversations");
    expect(provider).not.toContain("dm-kernel-sidebar-port");

    expect(controller).toContain("@/app/features/protocol-adaptation/layer");
    expect(controller).toMatch(/sendDm/);
    expect(controller).not.toMatch(/from\s+["']\.\/dm-send-pipeline["']/);

    expect(threadHook).toContain("@/app/features/protocol-adaptation/layer");
    expect(threadHook).toContain("listDmMessages");
    expect(threadHook).not.toMatch(/\bloadDmKernelThread\b/);
  });

  it("forbids messaging UI components from importing relay send/list ports", () => {
    const uiRoots = [
      path.join(featuresRoot, "messaging/components"),
      path.join(pwaRoot, "components"),
    ];
    const violations: string[] = [];

    for (const root of uiRoots) {
      let files: string[] = [];
      try {
        files = collectTsFiles(root);
      } catch {
        continue;
      }
      for (const file of files) {
        const source = readFileSync(file, "utf8");
        for (const pattern of forbiddenImportPatterns) {
          if (pattern.test(source)) {
            violations.push(`${path.relative(pwaRoot, file)} matches ${pattern}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("exposes Settings protocols shell with Nostr + Clearnet active", () => {
    const nav = readFileSync(path.join(pwaRoot, "settings/settings-nav.ts"), "utf8");
    const panel = readFileSync(
      path.join(pwaRoot, "settings/panels/protocols-settings-tab-panel.tsx"),
      "utf8",
    );
    expect(nav).toContain('"protocols"');
    expect(panel).toContain("SELECTABLE_PROTOCOL_IDS");
    expect(panel).toContain("protocol-option-");
    expect(panel).toContain("transport-option-");
    expect(panel).toContain("PROTOCOL_IDS");
    expect(panel).toContain("TRANSPORT_IDS");
    expect(panel).toContain("matrixLogin");
    expect(panel).toContain("matrixLoginAccessToken");
    expect(panel).toContain('data-testid="matrix-access-token"');
  });
});
