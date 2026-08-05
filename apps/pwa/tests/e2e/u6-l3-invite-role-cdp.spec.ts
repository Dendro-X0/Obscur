import { expect, test } from "@playwright/test";
import {
  U6_L3_CDP_MAIN,
  U6_L3_CDP_PROFILE,
  U6_L3_COMMUNITY_NAME,
  U6_L3_REPORT_PATH,
  assertShellReady,
  connectCdpPage,
  ensureProfile2Window,
  evaluateInviteMatrix,
  openDmWithPeer,
  probeCdpVersion,
  readInviteCards,
  writeU6L3Report,
} from "./helpers/u6-l3-invite-role-fixture";

test.describe("U6 L3 — dual CDP invite role Accept/Cancel", () => {
  test("inviter Cancel · invitee Accept+Decline on active invite", async ({ baseURL }) => {
    test.setTimeout(300_000);
    const startedAtUnixMs = Date.now();

    expect(
      await probeCdpVersion(U6_L3_CDP_MAIN, 15_000),
      `CDP main ${U6_L3_CDP_MAIN} must be up (pnpm dev:desktop:online)`,
    ).toBe(true);

    const main = await connectCdpPage(U6_L3_CDP_MAIN, baseURL);
    try {
      await assertShellReady(main.page, "Tester1");
      const profileOpen = await ensureProfile2Window(main.page);
      expect(profileOpen.opened, "desktop_open_profile_window(profile-2) must succeed").toBe(true);
    } finally {
      await main.browser.close().catch(() => undefined);
    }

    expect(
      await probeCdpVersion(U6_L3_CDP_PROFILE, 45_000),
      `CDP profile ${U6_L3_CDP_PROFILE} must listen after opening profile-2`,
    ).toBe(true);

    const inviterSession = await connectCdpPage(U6_L3_CDP_MAIN, baseURL);
    const inviteeSession = await connectCdpPage(U6_L3_CDP_PROFILE, baseURL);

    try {
      await assertShellReady(inviterSession.page, "Tester1");
      await assertShellReady(inviteeSession.page, "Tester2");

      await openDmWithPeer(inviterSession.page, "Tester2", baseURL);
      let inviterCards = await readInviteCards(inviterSession.page);

      await openDmWithPeer(inviteeSession.page, "Tester1", baseURL);
      let inviteeCards = await readInviteCards(inviteeSession.page);

      // One retry after brief wait — gift-wrap ingest can lag on degraded relays.
      if (inviterCards.length === 0 || inviteeCards.length === 0) {
        await inviterSession.page.waitForTimeout(5_000);
        await inviteeSession.page.waitForTimeout(5_000);
        await openDmWithPeer(inviterSession.page, "Tester2", baseURL);
        await openDmWithPeer(inviteeSession.page, "Tester1", baseURL);
        inviterCards = await readInviteCards(inviterSession.page);
        inviteeCards = await readInviteCards(inviteeSession.page);
      }

      const matrix = evaluateInviteMatrix(inviterCards, inviteeCards);
      const finishedAtUnixMs = Date.now();

      writeU6L3Report({
        schema: "obscur.u6.l3.invite-role@1",
        startedAtUnixMs,
        finishedAtUnixMs,
        communityName: U6_L3_COMMUNITY_NAME,
        inviter: {
          cdpUrl: U6_L3_CDP_MAIN,
          peerLabel: "Tester2",
          shellUnlocked: true,
          cards: inviterCards,
        },
        invitee: {
          cdpUrl: U6_L3_CDP_PROFILE,
          peerLabel: "Tester1",
          shellUnlocked: true,
          cards: inviteeCards,
        },
        l3: {
          pass: matrix.pass,
          inviterCancelOnly: matrix.inviterCancelOnly,
          inviteeAcceptDecline: matrix.inviteeAcceptDecline,
          blockedReason: matrix.blockedReason,
        },
      });

      expect(
        matrix.inviterCancelOnly,
        `Inviter must show Cancel only on active invite. Cards=${JSON.stringify(inviterCards)}`,
      ).toBe(true);
      expect(
        matrix.inviteeAcceptDecline,
        `Invitee must show Accept+Decline on active invite. Cards=${JSON.stringify(inviteeCards)}`,
      ).toBe(true);
      expect(matrix.pass, `Report: ${U6_L3_REPORT_PATH}`).toBe(true);
    } finally {
      await inviterSession.browser.close().catch(() => undefined);
      await inviteeSession.browser.close().catch(() => undefined);
    }
  });
});
