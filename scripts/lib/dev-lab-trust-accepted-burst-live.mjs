/**
 * trust-accepted-burst-live — TRUST-INT-1a L3 regression:
 * accepted Tester1 ↔ Tester2 rapid benign DMs must not raise elevated trust banner.
 */

import { applyDevOperatorBundle, ensureDevLabAccountUnlocked, TESTER1, TESTER2 } from "./dev-lab-playwright-auth.mjs";
import { readRuntimeCapabilities, waitForDevLab, waitForMessagingReady } from "./dev-lab-playwright-shared.mjs";

const BURST_COUNT = 22;

/**
 * @param {Readonly<{ chromium: typeof import('playwright').chromium; appBase: string; log?: (msg: string) => void }>} deps
 */
export async function runTrustAcceptedBurstLiveScenario(deps) {
  const log = deps.log ?? (() => undefined);
  const browser = await deps.chromium.launch({ headless: true });
  const startedAt = Date.now();
  const contextA = await browser.newContext({ baseURL: deps.appBase });
  const contextB = await browser.newContext({ baseURL: deps.appBase });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const burstPrefix = `dev-lab-trust-burst-${Date.now()}`;

  try {
    await pageA.goto("/");
    await pageB.goto("/");
    await applyDevOperatorBundle(pageA);
    await applyDevOperatorBundle(pageB);
    await waitForDevLab(pageA);
    await waitForDevLab(pageB);

    await ensureDevLabAccountUnlocked(pageA, "tester1", { log, timeoutMs: 120_000 });
    await ensureDevLabAccountUnlocked(pageB, "tester2", { log, timeoutMs: 120_000 });
    await waitForMessagingReady(pageA);
    await waitForMessagingReady(pageB);

    const seedBundle = await pageA.evaluate(({ ownerHex, peerHex }) => {
      const seeded = window.obscurDevLab?.seedAcceptedPeer?.({
        ownerPublicKeyHex: ownerHex,
        peerPublicKeyHex: peerHex,
      }) ?? { seeded: false };
      return { seeded: seeded.seeded === true };
    }, { ownerHex: TESTER1.privateKeyHex, peerHex: TESTER2.publicKeyHex });

    await pageA.reload();
    await applyDevOperatorBundle(pageA);
    await waitForDevLab(pageA);
    await ensureDevLabAccountUnlocked(pageA, "tester1", { log, timeoutMs: 120_000 });
    await waitForMessagingReady(pageA);

    await pageA.evaluate(({ peerHex }) => {
      window.obscurDevLab?.seedEstablishedTrustThread?.({
        peerPublicKeyHex: peerHex,
        firstPeerMessageAtUnixMs: Date.now() - 86_400_000,
      });
    }, { peerHex: TESTER2.publicKeyHex });

    const graphProbe = await pageA.evaluate(({ peerHex }) => (
      window.obscurDevLab?.probeMembershipGraph?.({ peerPublicKeyHex: peerHex }) ?? null
    ), { peerHex: TESTER2.publicKeyHex });

    const sendResults = [];
    for (let index = 0; index < BURST_COUNT; index += 1) {
      const text = `${burstPrefix} ping ${index + 1}`;
      const sendResult = await pageB.evaluate(async ({ peerHex, messageText }) => (
        window.obscurDevLab?.sendSyntheticDm?.({ peerPublicKeyHex: peerHex, text: messageText })
      ), { peerHex: TESTER1.privateKeyHex, messageText: text });
      sendResults.push(sendResult);
      if (sendResult?.success === false || sendResult?.deliveryStatus === "failed") {
        break;
      }
    }

    const sendPassed = sendResults.length === BURST_COUNT
      && sendResults.every((result) => result?.success !== false && result?.deliveryStatus !== "failed");

    const lastText = `${burstPrefix} ping ${BURST_COUNT}`;
    let receivePassed = false;
    const receiveDeadline = Date.now() + 60_000;
    while (Date.now() < receiveDeadline) {
      receivePassed = await pageA.evaluate(({ peerHex, text }) => {
        const messages = window.obscurDevLab?.getMessagesForPeer?.(peerHex) ?? [];
        return messages.some((message) => message.content === text);
      }, { peerHex: TESTER2.publicKeyHex, text: lastText });
      if (receivePassed) {
        break;
      }
      await pageA.waitForTimeout(1000);
    }

    const openChat = await pageA.evaluate(async (needle) => (
      window.obscurDevLab?.openDmChatContainingText?.(needle) ?? { opened: false, pathname: "" }
    ), burstPrefix);

    let bannerProbe = null;
    const bannerDeadline = Date.now() + 15_000;
    while (Date.now() < bannerDeadline) {
      bannerProbe = await pageA.evaluate(() => (
        window.obscurDevLab?.probeDmTrustBannerDom?.() ?? null
      ));
      if (bannerProbe?.visible) {
        break;
      }
      await pageA.waitForTimeout(400);
    }

    const assessmentProbe = await pageA.evaluate(({ peerHex }) => (
      window.obscurDevLab?.probeDmTrustAssessmentForPeer?.({ peerPublicKeyHex: peerHex }) ?? null
    ), { peerHex: TESTER2.publicKeyHex });

    const runtimeCaps = await readRuntimeCapabilities(pageA);
    const domRequired = runtimeCaps.isNativeRuntime === true;

    const elevatedDom = bannerProbe?.tier === "elevated" || bannerProbe?.tier === "critical";
    const elevatedAssessment = assessmentProbe?.assessment?.tier === "elevated"
      || assessmentProbe?.assessment?.tier === "critical";
    const bannerSuppressed = domRequired
      ? !elevatedDom
      : !elevatedAssessment;
    const assessmentSuppressed = !assessmentProbe?.showBanner
      && assessmentProbe?.assessment?.tier !== "elevated"
      && assessmentProbe?.assessment?.tier !== "critical";
    const graphLayer0Ok = graphProbe?.layers?.find((layer) => layer.layer === "layer0_social")?.ok === true;

    const shellHealth = await pageA.evaluate(() => (
      window.obscurDevLab?.probeShellHealth?.() ?? null
    ));

    return {
      id: "trust-accepted-burst-live",
      name: "TRUST-INT-1a accepted peer rapid DM — no elevated banner",
      category: "security",
      passed: seedBundle.seeded
        && sendPassed
        && receivePassed
        && openChat.opened
        && bannerSuppressed
        && assessmentSuppressed
        && graphLayer0Ok
        && shellHealth?.rootFatalBoundary !== true,
      durationMs: Date.now() - startedAt,
      steps: [
        {
          id: "seed_accepted_peer",
          passed: seedBundle.seeded,
          message: seedBundle.seeded
            ? "Tester1 legacy peer trust seeded with Tester2."
            : "Failed to seed accepted peer in localStorage.",
          durationMs: 0,
          context: { seedBundle },
        },
        {
          id: "membership_graph_layer0",
          passed: graphLayer0Ok,
          message: graphLayer0Ok
            ? "Membership graph reports social edge to Tester2."
            : `Layer0 social edge missing: ${JSON.stringify(graphProbe?.layers?.find((layer) => layer.layer === "layer0_social"))}`,
          durationMs: 0,
          context: { graphProbe },
        },
        {
          id: "tester2_burst_send",
          passed: sendPassed,
          message: sendPassed
            ? `Tester2 sent ${BURST_COUNT} benign DMs within burst window.`
            : `Burst send failed after ${sendResults.length}/${BURST_COUNT} messages.`,
          durationMs: 0,
          context: { burstCount: BURST_COUNT, sendResults: sendResults.slice(-3) },
        },
        {
          id: "tester1_receive_burst",
          passed: receivePassed,
          message: receivePassed
            ? "Tester1 observed final burst message."
            : "Tester1 did not observe burst terminus within 60s.",
          durationMs: 0,
        },
        {
          id: "tester1_open_dm_chat",
          passed: openChat.opened,
          message: openChat.opened
            ? `Opened DM chat (${openChat.pathname}).`
            : "Failed to open burst DM chat row.",
          durationMs: 0,
          context: { openChat },
        },
        {
          id: "tester1_trust_banner_suppressed",
          passed: bannerSuppressed,
          message: domRequired
            ? (bannerSuppressed
              ? `No elevated/critical banner (tier=${bannerProbe?.tier ?? "none"}).`
              : `Unexpected elevated banner: ${JSON.stringify(bannerProbe)}`)
            : (bannerSuppressed
              ? "Web Playwright: assessment tier check passed (native DOM skipped)."
              : `Assessment tier elevated: ${JSON.stringify(assessmentProbe)}`),
          durationMs: 0,
          context: { bannerProbe, domRequired, runtimeCaps },
        },
        {
          id: "tester1_trust_assessment_suppressed",
          passed: assessmentSuppressed,
          message: assessmentSuppressed
            ? `Assessment suppressed (tier=${assessmentProbe?.assessment?.tier ?? "none"}).`
            : `Assessment unexpectedly elevated: ${JSON.stringify(assessmentProbe)}`,
          durationMs: 0,
          context: { assessmentProbe },
        },
        {
          id: "tester1_shell",
          passed: shellHealth?.healthy === true,
          message: shellHealth?.healthy
            ? "Tester1 shell healthy after burst."
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
