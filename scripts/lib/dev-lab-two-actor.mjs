/**
 * Two-actor DM scenario — Tester2 sends, Tester1 receives (Playwright dual context).
 */

import { applyDevOperatorBundle, ensureDevLabAccountUnlocked } from "./dev-lab-playwright-auth.mjs";
import { waitForDevLab, waitForMessagingReady } from "./dev-lab-playwright-shared.mjs";

const TESTER1_PUBKEY_HEX = "c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884";
const TESTER2_PUBKEY_HEX = "3db055b47e05bdfb9083efec0b7aecd2a045dbf7d865cf4d95d98817d946830f";

/**
 * @param {Readonly<{ chromium: typeof import('playwright').chromium; appBase: string; log?: (msg: string) => void }>} deps
 */
export async function runTwoActorDmScenario(deps) {
  const log = deps.log ?? (() => undefined);
  const browser = await deps.chromium.launch({ headless: true });
  const startedAt = Date.now();
  const contextA = await browser.newContext({ baseURL: deps.appBase });
  const contextB = await browser.newContext({ baseURL: deps.appBase });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

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

    const messageText = `dev-lab-two-actor-${Date.now()}`;
    const sendResult = await pageB.evaluate(async ({ peerHex, text }) => {
      return window.obscurDevLab?.sendSyntheticDm?.({ peerPublicKeyHex: peerHex, text });
    }, { peerHex: TESTER1_PUBKEY_HEX, text: messageText });

    const sendPassed = sendResult?.success !== false && sendResult?.deliveryStatus !== "failed";

    let receivePassed = false;
    const receiveDeadline = Date.now() + 30_000;
    while (Date.now() < receiveDeadline) {
      receivePassed = await pageA.evaluate(({ peerHex, text }) => {
        const messages = window.obscurDevLab?.getMessagesForPeer?.(peerHex) ?? [];
        return messages.some((message) => message.content === text);
      }, { peerHex: TESTER2_PUBKEY_HEX, text: messageText });
      if (receivePassed) {
        break;
      }
      await pageA.waitForTimeout(1000);
    }

    const shellHealth = await pageA.evaluate(() => window.obscurDevLab?.probeShellHealth?.() ?? null);

    return {
      id: "two-actor-dm",
      name: "Tester2 → Tester1 DM (CLI dual browser)",
      category: "messaging",
      passed: sendPassed && receivePassed && shellHealth?.rootFatalBoundary !== true,
      durationMs: Date.now() - startedAt,
      steps: [
        {
          id: "tester2_send",
          passed: sendPassed,
          message: sendPassed ? "Tester2 send accepted." : `Send failed: ${sendResult?.error ?? sendResult?.deliveryStatus ?? "unknown"}`,
          durationMs: 0,
          context: { sendResult, messageText },
        },
        {
          id: "tester1_receive",
          passed: receivePassed,
          message: receivePassed ? "Tester1 received message in thread." : "Tester1 did not observe message within 30s.",
          durationMs: 0,
        },
        {
          id: "tester1_shell",
          passed: shellHealth?.healthy === true,
          message: shellHealth?.healthy ? "Tester1 shell healthy." : `Tester1 shell issues: ${shellHealth?.issues?.join(", ") ?? "unknown"}`,
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
