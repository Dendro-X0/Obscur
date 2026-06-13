/**
 * trust-live — dual-browser TRUST-1 live: zombie cold financial DM + recipient banner DOM.
 */

import { applyDevOperatorBundle, ensureDevLabAccountUnlocked } from "./dev-lab-playwright-auth.mjs";
import { readRuntimeCapabilities, waitForDevLab, waitForMessagingReady } from "./dev-lab-playwright-shared.mjs";

const TESTER1_PUBKEY_HEX = "c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884";

/**
 * @param {Readonly<{ chromium: typeof import('playwright').chromium; appBase: string; log?: (msg: string) => void }>} deps
 */
export async function runTrustLiveScenario(deps) {
  const log = deps.log ?? (() => undefined);
  const browser = await deps.chromium.launch({ headless: true });
  const startedAt = Date.now();
  const contextA = await browser.newContext({ baseURL: deps.appBase });
  const contextB = await browser.newContext({ baseURL: deps.appBase });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const messageNeedle = `dev-lab-trust-live-${Date.now()}`;
  const financialText = `${messageNeedle} send $250 wire transfer today`;

  try {
    await pageA.goto("/");
    await pageB.goto("/");
    await applyDevOperatorBundle(pageA);
    await applyDevOperatorBundle(pageB);
    await waitForDevLab(pageA);
    await waitForDevLab(pageB);

    await ensureDevLabAccountUnlocked(pageA, "tester1", { log, timeoutMs: 120_000 });
    await waitForMessagingReady(pageA);

    const persona = await pageB.evaluate(async () => {
      const lab = window.obscurDevLab;
      if (!lab?.createZombiePersona || !lab.unlockZombiePersona) {
        throw new Error("dev_lab_zombie_api_missing");
      }
      const created = lab.createZombiePersona({ label: "trust-live-sender" });
      await lab.unlockZombiePersona(created.id);
      return created;
    });
    await waitForMessagingReady(pageB);

    const sendBundle = await pageB.evaluate(async (params) => {
      const lab = window.obscurDevLab;
      if (!lab?.sendSyntheticDm) {
        return { ok: false, error: "dev_lab_api_missing" };
      }
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      const sendResult = await lab.sendSyntheticDm({
        peerPublicKeyHex: params.tester1Hex,
        text: params.text,
      });
      const sendPassed = sendResult.success !== false && sendResult.deliveryStatus !== "failed";
      return {
        ok: sendPassed,
        persona: params.persona,
        sendResult,
        messagingStatus: lab.getMessagingStatus?.() ?? null,
      };
    }, { tester1Hex: TESTER1_PUBKEY_HEX, text: financialText, persona });

    const sendPassed = sendBundle.ok === true;
    log(sendPassed ? "zombie financial DM sent" : `zombie send failed: ${sendBundle.error ?? sendBundle.sendResult?.error ?? "unknown"}`);

    let receivePassed = false;
    const zombiePubkey = sendBundle.persona?.publicKeyHex ?? "";
    const receiveDeadline = Date.now() + 45_000;
    while (Date.now() < receiveDeadline && zombiePubkey) {
      receivePassed = await pageA.evaluate(({ peerHex, text }) => {
        const messages = window.obscurDevLab?.getMessagesForPeer?.(peerHex) ?? [];
        return messages.some((message) => message.content === text);
      }, { peerHex: zombiePubkey, text: financialText });
      if (receivePassed) {
        break;
      }
      await pageA.waitForTimeout(1000);
    }

    await pageA.evaluate(({ peerHex }) => {
      window.obscurDevLab?.clearDmTrustThreadForPeer?.({ peerPublicKeyHex: peerHex });
    }, { peerHex: zombiePubkey });

    const openChat = await pageA.evaluate(async (needle) => {
      return await window.obscurDevLab?.openDmChatContainingText?.(needle) ?? { opened: false, pathname: "" };
    }, messageNeedle);

    let bannerProbe = null;
    const bannerDeadline = Date.now() + 20_000;
    while (Date.now() < bannerDeadline) {
      bannerProbe = await pageA.evaluate(() => window.obscurDevLab?.probeDmTrustBannerDom?.() ?? null);
      if (bannerProbe?.visible && (bannerProbe.tier === "elevated" || bannerProbe.tier === "critical")) {
        break;
      }
      await pageA.waitForTimeout(500);
    }

    const assessmentProbe = await pageA.evaluate(({ peerHex }) => {
      return window.obscurDevLab?.probeDmTrustAssessmentForPeer?.({
        peerPublicKeyHex: peerHex,
        isPeerAccepted: false,
      }) ?? null;
    }, { peerHex: zombiePubkey });

    const runtimeCaps = await readRuntimeCapabilities(pageA);
    const domRequired = runtimeCaps.isNativeRuntime === true;

    const senderBannerProbe = await pageB.evaluate(() => (
      window.obscurDevLab?.probeDmTrustBannerDom?.() ?? null
    ));

    const bannerDomPassed = bannerProbe?.visible === true
      && (bannerProbe.tier === "elevated" || bannerProbe.tier === "critical");
    const assessmentPassed = assessmentProbe?.showBanner === true
      && assessmentProbe.assessment?.bundleId === "BUNDLE_FIN_COLD";
    const bannerPassed = domRequired ? bannerDomPassed : assessmentPassed;
    const senderSilencePassed = senderBannerProbe?.visible !== true;

    const shellHealth = await pageA.evaluate(() => window.obscurDevLab?.probeShellHealth?.() ?? null);

    await pageB.evaluate(() => {
      window.obscurDevLab?.teardownAllZombiePersonas?.();
    });

    return {
      id: "trust-live",
      name: "TRUST-1 live cold financial banner (CLI dual browser)",
      category: "security",
      passed: sendPassed
        && receivePassed
        && openChat.opened
        && bannerPassed
        && assessmentPassed
        && senderSilencePassed
        && shellHealth?.rootFatalBoundary !== true,
      durationMs: Date.now() - startedAt,
      steps: [
        {
          id: "zombie_send_fin_cold",
          passed: sendPassed,
          message: sendPassed
            ? "Zombie persona sent cold financial DM to Tester1."
            : `Zombie send failed: ${sendBundle.error ?? sendBundle.sendResult?.error ?? sendBundle.sendResult?.deliveryStatus ?? "unknown"}`,
          durationMs: 0,
          context: { sendBundle, financialText },
        },
        {
          id: "tester1_receive",
          passed: receivePassed,
          message: receivePassed
            ? "Tester1 controller observed inbound financial DM."
            : "Tester1 did not observe inbound DM within 45s.",
          durationMs: 0,
          context: { zombiePubkey },
        },
        {
          id: "tester1_open_dm_chat",
          passed: openChat.opened,
          message: openChat.opened
            ? `Opened DM chat (${openChat.pathname}).`
            : "Failed to open DM chat row for inbound message.",
          durationMs: 0,
          context: { openChat },
        },
        {
          id: "tester1_trust_banner_dom",
          passed: bannerPassed,
          message: domRequired
            ? (bannerDomPassed
              ? `Recipient trust banner visible (tier=${bannerProbe?.tier}).`
              : `Trust banner missing or tier too low: ${JSON.stringify(bannerProbe)}`)
            : (assessmentPassed
              ? "Web Playwright: dm-kernel banner skipped; assessment probe passed."
              : `Web Playwright: assessment probe failed: ${JSON.stringify(assessmentProbe)}`),
          durationMs: 0,
          context: { bannerProbe, domRequired, runtimeCaps },
        },
        {
          id: "tester1_trust_assessment_probe",
          passed: assessmentPassed,
          message: assessmentPassed
            ? `Assessment probe shows BUNDLE_FIN_COLD (tier=${assessmentProbe?.assessment?.tier}).`
            : `Assessment probe failed: ${JSON.stringify(assessmentProbe)}`,
          durationMs: 0,
          context: { assessmentProbe },
        },
        {
          id: "sender_silence_no_banner",
          passed: senderSilencePassed,
          message: senderSilencePassed
            ? "Sender context has no recipient trust banner."
            : `Sender context unexpectedly shows banner: ${JSON.stringify(senderBannerProbe)}`,
          durationMs: 0,
          context: { senderBannerProbe },
        },
        {
          id: "tester1_shell",
          passed: shellHealth?.healthy === true,
          message: shellHealth?.healthy
            ? "Tester1 shell healthy after trust banner."
            : `Tester1 shell issues: ${shellHealth?.issues?.join(", ") ?? "unknown"}`,
          durationMs: 0,
          context: { shellHealth },
        },
      ],
    };
  } finally {
    await contextA.close();
    await contextB.close();
    await browser.close();
  }
}
