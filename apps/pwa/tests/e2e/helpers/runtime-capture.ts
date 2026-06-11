import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { gotoApp } from "./app-url";

export type DevLabShellHealthSnapshot = Readonly<{
  healthy: boolean;
  shellUnlocked: boolean;
  rootFatalBoundary: boolean;
  settingsTabBoundary: boolean;
  issues: ReadonlyArray<string>;
  fatalBoundaryMessage: string | null;
}>;

export type RuntimeCapabilitiesSnapshot = Readonly<{
  isNativeRuntime: boolean;
  isDesktop: boolean;
  isMobile: boolean;
  hasCallableNativeBridge: boolean;
  hostname: string | null;
}>;

export type M0TriageBundle = Readonly<{
  version: string;
  generatedAtUnixMs: number;
  checks?: Readonly<{
    requiredApis?: Readonly<Record<string, boolean>>;
  }>;
}>;

export type DmKernelWriteProbeSnapshot = Readonly<{
  ok: boolean;
  reason: string;
  errorMessage: string | null;
}>;

export type DmKernelOneSidedConversationSnapshot = Readonly<{
  conversationId: string;
  peerPublicKeyHex: string;
  missingDirection: "incoming" | "outgoing";
  outgoing: number;
  incoming: number;
  total: number;
}>;

export type DmKernelBidirectionalGateSnapshot = Readonly<{
  peerPublicKeyHex: string;
  total: number;
  outgoing: number;
  incoming: number;
  bidirectional: boolean;
  skipped: boolean;
  reason: string;
}>;

export type DmKernelRuntimeGateSnapshot = Readonly<{
  devLabAvailable: boolean;
  writeProbe: DmKernelWriteProbeSnapshot | null;
  oneSidedConversations: ReadonlyArray<DmKernelOneSidedConversationSnapshot> | null;
  bidirectional?: DmKernelBidirectionalGateSnapshot | null;
}>;

const DEFAULT_EVENT_WINDOW = 300;

export const captureM0Bundle = async (
  page: Page,
  eventWindowSize = DEFAULT_EVENT_WINDOW,
): Promise<M0TriageBundle | null> => {
  return page.evaluate((windowSize) => {
    const api = window.obscurM0Triage;
    if (!api || typeof api.capture !== "function") {
      return null;
    }
    return api.capture(windowSize) as M0TriageBundle;
  }, eventWindowSize);
};

export const captureCrossDeviceDigest = async (
  page: Page,
  eventWindowSize = 400,
): Promise<unknown | null> => {
  return page.evaluate((windowSize) => {
    const api = window.obscurAppEvents;
    if (!api || typeof api.getCrossDeviceSyncDigest !== "function") {
      return null;
    }
    return api.getCrossDeviceSyncDigest(windowSize);
  }, eventWindowSize);
};

/** Native dm-kernel programmatic gate — SQLite write roundtrip + one-sided scan via Dev Lab bridge. */
export const captureDmKernelBidirectionalGate = async (
  page: Page,
  peerPublicKeyHex: string,
): Promise<DmKernelBidirectionalGateSnapshot> => {
  return page.evaluate(async (peerHex) => {
    const lab = window.obscurDevLab;
    if (!lab?.getSqliteMessagesForPeer) {
      return {
        peerPublicKeyHex: peerHex,
        total: 0,
        outgoing: 0,
        incoming: 0,
        bidirectional: false,
        skipped: true,
        reason: "sqlite_peer_api_unavailable",
      };
    }
    const snapshots = await lab.getSqliteMessagesForPeer(peerHex);
    let outgoing = 0;
    let incoming = 0;
    for (const row of snapshots) {
      if (row.isOutgoing) {
        outgoing += 1;
      } else {
        incoming += 1;
      }
    }
    if (snapshots.length === 0) {
      return {
        peerPublicKeyHex: peerHex,
        total: 0,
        outgoing: 0,
        incoming: 0,
        bidirectional: false,
        skipped: true,
        reason: "no_sqlite_thread",
      };
    }
    const bidirectional = outgoing > 0 && incoming > 0;
    return {
      peerPublicKeyHex: peerHex,
      total: snapshots.length,
      outgoing,
      incoming,
      bidirectional,
      skipped: false,
      reason: bidirectional ? "bidirectional_ok" : "one_sided_thread",
    };
  }, peerPublicKeyHex);
};

export const assertDmKernelBidirectionalGate = (
  gate: DmKernelBidirectionalGateSnapshot,
  context: string,
): void => {
  if (gate.skipped) {
    throw new Error(
      `dm-kernel bidirectional gate skipped after ${context}: ${gate.reason} `
      + `(seed Tester1↔Tester2 SQLite thread or set OBSCUR_DM_KERNEL_ALLOW_EMPTY_BIDIRECTIONAL=1)`,
    );
  }
  if (!gate.bidirectional) {
    throw new Error(
      `dm-kernel bidirectional gate failed after ${context}: `
      + `outgoing=${gate.outgoing} incoming=${gate.incoming} (${gate.reason})`,
    );
  }
};

export const captureDmKernelRuntimeGate = async (
  page: Page,
  options?: Readonly<{ peerPublicKeyHex?: string }>,
): Promise<DmKernelRuntimeGateSnapshot> => {
  const base = await page.evaluate(async () => {
    const lab = window.obscurDevLab;
    if (!lab) {
      return {
        devLabAvailable: false,
        writeProbe: null,
        oneSidedConversations: null,
      };
    }

    const writeProbe = typeof lab.probeNativeDmSqliteWrite === "function"
      ? await lab.probeNativeDmSqliteWrite()
      : null;
    const oneSidedConversations = typeof lab.scanOneSidedNativeDmConversations === "function"
      ? await lab.scanOneSidedNativeDmConversations()
      : null;

    return {
      devLabAvailable: true,
      writeProbe,
      oneSidedConversations,
    };
  });

  const peerPublicKeyHex = options?.peerPublicKeyHex?.trim();
  if (!peerPublicKeyHex) {
    return base;
  }

  const bidirectional = await captureDmKernelBidirectionalGate(page, peerPublicKeyHex);
  return { ...base, bidirectional };
};

export const assertDmKernelRuntimeGate = (
  gate: DmKernelRuntimeGateSnapshot,
  context: string,
): void => {
  if (!gate.devLabAvailable) {
    throw new Error(`dm-kernel gate unavailable after ${context}: obscurDevLab not installed`);
  }
  if (!gate.writeProbe?.ok) {
    const detail = gate.writeProbe?.errorMessage ?? gate.writeProbe?.reason ?? "probe_unavailable";
    throw new Error(`dm-kernel write probe failed after ${context}: ${detail}`);
  }
  const oneSidedCount = gate.oneSidedConversations?.length ?? 0;
  if (oneSidedCount > 0) {
    const sample = gate.oneSidedConversations?.slice(0, 3).map((entry) => entry.conversationId).join(", ");
    throw new Error(
      `dm-kernel one-sided SQLite detected after ${context}: ${oneSidedCount} conversation(s) (${sample})`,
    );
  }
};

export const readRuntimeCapabilities = async (
  page: Page,
): Promise<RuntimeCapabilitiesSnapshot> => {
  return page.evaluate(() => {
    const w = window as Window & {
      __TAURI__?: { core?: { invoke?: unknown } };
      __TAURI_INTERNALS__?: { invoke?: unknown };
      __TAURI_IPC__?: unknown;
    };
    const hasCallableNativeBridge =
      typeof w.__TAURI_INTERNALS__?.invoke === "function"
      || typeof w.__TAURI__?.core?.invoke === "function"
      || typeof w.__TAURI_IPC__ === "function";
    const hostname = window.location?.hostname ?? null;
    return {
      isNativeRuntime: hasCallableNativeBridge,
      isDesktop: hasCallableNativeBridge,
      isMobile: false,
      hasCallableNativeBridge,
      hostname,
    };
  });
};

export const runNavigationSoak = async (
  page: Page,
  baseURL?: string | null,
): Promise<ReadonlyArray<string>> => {
  const routes: ReadonlyArray<Readonly<{ label: string; href: string }>> = [
    { label: "Network", href: "/network" },
    { label: "Settings", href: "/settings" },
    { label: "Search", href: "/search" },
    { label: "Chats", href: "/" },
  ];
  const visited: string[] = [];

  for (const route of routes) {
    const link = page.getByRole("link", { name: route.label, exact: true });
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await page.waitForLoadState("domcontentloaded");
      visited.push(route.href);
      await page.waitForTimeout(400);
      continue;
    }
    await gotoApp(page, route.href, baseURL);
    await page.waitForLoadState("domcontentloaded");
    visited.push(route.href);
    await page.waitForTimeout(400);
  }

  return visited;
};

export const probeShellHealth = async (page: Page): Promise<DevLabShellHealthSnapshot> => {
  return page.evaluate(() => {
    const api = window.obscurDevLab;
    if (api && typeof api.probeShellHealth === "function") {
      const health = api.probeShellHealth();
      return {
        healthy: health.healthy,
        shellUnlocked: health.shellUnlocked,
        rootFatalBoundary: health.rootFatalBoundary,
        settingsTabBoundary: health.settingsTabBoundary,
        issues: health.issues,
        fatalBoundaryMessage: health.fatalBoundaryMessage,
      };
    }
    const rootBoundary = Boolean(
      document.querySelector('[data-testid="root-error-boundary"]')
      || document.querySelector("h1")?.textContent?.includes("Oops! Something went wrong"),
    );
    const settingsBoundary = Boolean(
      document.querySelector('[data-testid^="settings-tab-error-"]'),
    );
    const shellUnlocked = !rootBoundary && Boolean(
      document.querySelector('a[aria-label="Settings"]')
      || document.querySelector('a[aria-label="Network"]'),
    );
    const issues: string[] = [];
    if (rootBoundary) issues.push("root_fatal_error_boundary");
    if (settingsBoundary) issues.push("settings_tab_error_boundary");
    if (!shellUnlocked && !rootBoundary) issues.push("shell_not_unlocked");
    return {
      healthy: issues.length === 0,
      shellUnlocked,
      rootFatalBoundary: rootBoundary,
      settingsTabBoundary: settingsBoundary,
      issues,
      fatalBoundaryMessage: rootBoundary ? "Root error boundary active" : null,
    };
  });
};

export const assertShellHealthy = async (page: Page, context: string): Promise<void> => {
  const health = await probeShellHealth(page);
  if (!health.healthy) {
    const detail = health.fatalBoundaryMessage ?? health.issues.join(", ");
    throw new Error(`Shell unhealthy after ${context}: ${detail}`);
  }
};

export const resolveCaptureOutDir = (): string => {
  const fromEnv = process.env.RUNTIME_CAPTURE_OUT_DIR?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return path.resolve(process.cwd(), "test-results", "runtime-capture");
};

export const writeRuntimeCaptureReport = (fileName: string, payload: unknown): string => {
  const outDir = resolveCaptureOutDir();
  fs.mkdirSync(outDir, { recursive: true });
  const filePath = path.join(outDir, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
};
