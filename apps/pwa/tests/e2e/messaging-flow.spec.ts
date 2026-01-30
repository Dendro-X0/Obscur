import { expect, test } from "@playwright/test";
import { createE2eHarness } from "./helpers/e2e-harness";

const shouldRunRealRelay: boolean = process.env.E2E_REAL_RELAY === "true";
const shouldAssertDelivery: boolean = process.env.E2E_ASSERT_DELIVERY === "true";

test.describe("messaging flow", () => {
  test.skip(!shouldRunRealRelay, "Set E2E_REAL_RELAY=true to run real relay messaging tests");

  test("user A and user B can create identities and send a DM", async ({ browser }) => {
    const harness = createE2eHarness({ passphrase: "obscur-e2e-passphrase" });

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    const userA = await harness.ensureUnlockedIdentity(pageA);
    const userB = await harness.ensureUnlockedIdentity(pageB);

    await expect(userA.publicKeyHex).not.toEqual(userB.publicKeyHex);

    await pageA.goto("/invites");
    await expect(pageA.locator("body")).not.toContainText("404");

    await harness.openDirectMessageByPubkeyHex({ page: pageB, peerPublicKeyHex: userA.publicKeyHex });

    const messageText: string = `e2e-${Date.now()}`;
    await harness.sendMessage({ page: pageB, text: messageText });

    await expect(pageB.locator("body")).toContainText(messageText);

    if (shouldAssertDelivery) {
      await harness.openDirectMessageByPubkeyHex({ page: pageA, peerPublicKeyHex: userB.publicKeyHex });
      await expect(pageA.locator("body")).toContainText(messageText, { timeout: 30_000 });
    }

    await contextA.close();
    await contextB.close();
  });
});
