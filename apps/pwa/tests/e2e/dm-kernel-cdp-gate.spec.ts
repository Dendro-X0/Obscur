import { chromium, expect, test as base } from "@playwright/test";
import {
  applyOperatorDevBundle,
  ensureUnlockedForRuntimeCapture,
  TESTER1,
} from "./helpers/dev-test-accounts";
import { DEV_LAB_ACCOUNTS } from "../../app/features/dev-lab/dev-lab-accounts";
import {
  assertDmKernelBidirectionalGate,
  assertDmKernelRuntimeGate,
  captureDmKernelBidirectionalGate,
  captureDmKernelRuntimeGate,
  probeShellHealth,
  readRuntimeCapabilities,
  writeRuntimeCaptureReport,
} from "./helpers/runtime-capture";
import { resolveAppBaseUrl } from "./helpers/app-url";
import { pickAppPageFromCdpBrowserAsync } from "./helpers/cdp-page";

const CDP_URL = process.env.OBSCUR_CDP_URL?.trim() || null;

const test = base.extend({
  page: async ({ baseURL }, use) => {
    if (!CDP_URL) {
      throw new Error("OBSCUR_CDP_URL is required for dm-kernel CDP gate");
    }
    const browser = await chromium.connectOverCDP(CDP_URL);
    const cdpPage = await pickAppPageFromCdpBrowserAsync(browser, baseURL);
    if (!cdpPage) {
      const urls = browser.contexts().flatMap((ctx) => ctx.pages().map((p) => p.url()));
      await browser.close();
      throw new Error(
        [
          `No Obscur page on CDP endpoint ${CDP_URL}.`,
          "Launch Tauri with WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222",
          urls.length > 0 ? `CDP pages seen: ${urls.join(", ")}` : "CDP has no open pages — is Tauri running?",
        ].join(" "),
      );
    }
    await use(cdpPage);
    await browser.close();
  },
});

test.describe("dm-kernel CDP gate", () => {
  test.skip(!CDP_URL, "Set OBSCUR_CDP_URL=http://127.0.0.1:9222 to run native dm-kernel gate");

  test("sqlite write roundtrip + no one-sided conversations", async ({ page, baseURL }) => {
    const startupWaitMs = Number.parseInt(process.env.OBSCUR_RUNTIME_CAPTURE_STARTUP_TIMEOUT_MS ?? "180000", 10);
    test.setTimeout(Math.max(240_000, startupWaitMs + 60_000));

    const appBaseUrl = resolveAppBaseUrl(baseURL);
    await applyOperatorDevBundle(page);
    await ensureUnlockedForRuntimeCapture(page, TESTER1, appBaseUrl, { cdpNative: true });

    const runtimeCapabilities = await readRuntimeCapabilities(page);
    expect(
      runtimeCapabilities.isNativeRuntime,
      "Native Tauri bridge required for dm-kernel CDP gate",
    ).toBe(true);

    const shellHealth = await probeShellHealth(page);
    expect(shellHealth.healthy, shellHealth.issues.join(", ")).toBe(true);

    const tester2Peer = DEV_LAB_ACCOUNTS.tester2.publicKeyHex!;
    const dmKernelGate = await captureDmKernelRuntimeGate(page, {
      peerPublicKeyHex: tester2Peer,
    });
    assertDmKernelRuntimeGate(dmKernelGate, "native_unlock");

    const allowEmptyBidirectional = process.env.OBSCUR_DM_KERNEL_ALLOW_EMPTY_BIDIRECTIONAL === "1";
    const bidirectionalGate = dmKernelGate.bidirectional
      ?? await captureDmKernelBidirectionalGate(page, tester2Peer);
    if (!allowEmptyBidirectional) {
      assertDmKernelBidirectionalGate(bidirectionalGate, "native_unlock_tester2_thread");
    }

    writeRuntimeCaptureReport("dm-kernel-cdp-gate-latest.json", {
      schema: "obscur.dm-kernel-cdp-gate.v1",
      generatedAtUnixMs: Date.now(),
      baseUrl: appBaseUrl,
      runtimeCapabilities,
      shellHealth,
      dmKernelGate,
      bidirectionalGate,
      allowEmptyBidirectional,
      passed: true,
    });
  });

  test("transport repair listener dispatches missed-message sync", async ({ page, baseURL }) => {
    test.setTimeout(120_000);
    const appBaseUrl = resolveAppBaseUrl(baseURL);
    await applyOperatorDevBundle(page);
    await ensureUnlockedForRuntimeCapture(page, TESTER1, appBaseUrl, { cdpNative: true });

    const repairSmoke = await page.evaluate(async () => {
      const lab = window.obscurDevLab;
      if (!lab?.forceNativeDmRelayBackfillSync || !lab.triggerMissedMessageSync) {
        return { ok: false, reason: "dev_lab_repair_api_missing" };
      }
      const dispatched = await lab.forceNativeDmRelayBackfillSync();
      await lab.triggerMissedMessageSync();
      return { ok: dispatched, reason: dispatched ? "repair_dispatched" : "repair_not_dispatched" };
    });

    expect(repairSmoke.ok, repairSmoke.reason).toBe(true);
  });
});
