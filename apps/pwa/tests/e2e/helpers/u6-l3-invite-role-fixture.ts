import fs from "node:fs";
import path from "node:path";
import type { Browser, Page } from "@playwright/test";
import { chromium } from "@playwright/test";
import {
  applyOperatorDevBundle,
  isAppShellUnlocked,
  TESTER1,
  TESTER2,
} from "./dev-test-accounts";
import { waitForAppPageFromCdpBrowserAsync } from "./cdp-page";
import { resolveAppBaseUrl } from "./app-url";

export const U6_L3_CDP_MAIN = process.env.OBSCUR_CDP_URL?.trim() || "http://127.0.0.1:9230";
export const U6_L3_CDP_PROFILE = process.env.OBSCUR_CDP_PROFILE_URL?.trim() || "http://127.0.0.1:9231";
export const U6_L3_COMMUNITY_NAME = process.env.OBSCUR_U6_COMMUNITY_NAME?.trim() || "U6 Invite Role";

export const U6_L3_REPORT_PATH = path.resolve(
  process.cwd(),
  process.cwd().replace(/\\/g, "/").endsWith("/apps/pwa")
    ? "../../test-results/u6-l3-invite-role-2026-07-31.json"
    : "test-results/u6-l3-invite-role-2026-07-31.json",
);

export type U6L3InviteCardSnapshot = Readonly<{
  role: string | null;
  lifecycle: string | null;
  status: string | null;
  direction: string | null;
  buttons: ReadonlyArray<string>;
  hasAccept: boolean;
  hasDecline: boolean;
  hasCancel: boolean;
  text: string;
}>;

export type U6L3SideSnapshot = Readonly<{
  cdpUrl: string;
  peerLabel: string;
  shellUnlocked: boolean;
  cards: ReadonlyArray<U6L3InviteCardSnapshot>;
}>;

export type U6L3Report = Readonly<{
  schema: "obscur.u6.l3.invite-role@1";
  startedAtUnixMs: number;
  finishedAtUnixMs: number;
  communityName: string;
  inviter: U6L3SideSnapshot;
  invitee: U6L3SideSnapshot;
  l3: Readonly<{
    pass: boolean;
    inviterCancelOnly: boolean;
    inviteeAcceptDecline: boolean;
    blockedReason: string | null;
  }>;
}>;

export const probeCdpVersion = async (cdpUrl: string, timeoutMs = 5_000): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${cdpUrl.replace(/\/$/, "")}/json/version`);
      if (response.ok) {
        return true;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
};

export const connectCdpPage = async (
  cdpUrl: string,
  baseURL?: string | null,
): Promise<{ browser: Browser; page: Page }> => {
  const browser = await chromium.connectOverCDP(cdpUrl);
  const page = await waitForAppPageFromCdpBrowserAsync(browser, baseURL, { timeoutMs: 120_000 });
  if (!page) {
    await browser.close();
    throw new Error(`No Obscur page on CDP ${cdpUrl}`);
  }
  return { browser, page };
};

export const ensureProfile2Window = async (mainPage: Page): Promise<{
  created: boolean;
  profileId: string | null;
  opened: boolean;
}> => {
  return mainPage.evaluate(async () => {
    const tauri = (window as Window & {
      __TAURI_INTERNALS__?: {
        invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
    }).__TAURI_INTERNALS__;
    const invoke = tauri?.invoke;
    if (!invoke) {
      return { created: false, profileId: null, opened: false };
    }
    type ProfileSummary = { profileId: string; label: string };
    let list = (await invoke("desktop_list_profiles")) as ProfileSummary[];
    let created = false;
    let profile = list.find((entry) => entry.profileId === "profile-2")
      ?? list.find((entry) => /profile.?2|tester2/i.test(entry.label));
    if (!profile) {
      await invoke("desktop_create_profile", { label: "Profile 2" });
      created = true;
      list = (await invoke("desktop_list_profiles")) as ProfileSummary[];
      profile = list.find((entry) => entry.profileId === "profile-2")
        ?? list.find((entry) => /profile.?2/i.test(entry.label));
    }
    if (!profile) {
      return { created, profileId: null, opened: false };
    }
    await invoke("desktop_open_profile_window", { profileId: profile.profileId });
    return { created, profileId: profile.profileId, opened: true };
  });
};

export const readInviteCards = async (page: Page): Promise<ReadonlyArray<U6L3InviteCardSnapshot>> => (
  page.evaluate(() => (
    Array.from(document.querySelectorAll("[data-testid=community-invite-card]")).map((el) => {
      const buttons = Array.from(el.querySelectorAll("button")).map((button) => (
        (button.textContent ?? "").trim()
      ));
      return {
        role: el.getAttribute("data-invite-viewer-role"),
        lifecycle: el.getAttribute("data-invite-lifecycle"),
        status: el.getAttribute("data-invite-status"),
        direction: el.getAttribute("data-invite-direction"),
        buttons,
        hasAccept: buttons.some((label) => /^accept$/i.test(label)),
        hasDecline: buttons.some((label) => /^decline$/i.test(label)),
        hasCancel: buttons.some((label) => /cancel invitation/i.test(label)),
        text: (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
      };
    })
  ))
);

export const openDmWithPeer = async (
  page: Page,
  peerLabel: string,
  baseURL?: string | null,
): Promise<void> => {
  const base = resolveAppBaseUrl(baseURL);
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" }).catch(() => undefined);
  await page.waitForTimeout(1_200);
  await page.keyboard.press("Escape").catch(() => undefined);

  const chats = page.getByRole("button", { name: /chats/i })
    .or(page.getByRole("link", { name: /chats/i }));
  if (await chats.first().isVisible().catch(() => false)) {
    await chats.first().click().catch(() => undefined);
    await page.waitForTimeout(600);
  }
  await page.getByRole("button", { name: /^chat$/i }).click().catch(() => undefined);
  await page.waitForTimeout(800);

  const inviteHint = page.getByText(/invited you to|invitation to/i).first();
  if (await inviteHint.isVisible().catch(() => false)) {
    await inviteHint.click();
    await page.waitForTimeout(2_500);
    return;
  }

  const peer = page.getByText(peerLabel, { exact: true }).first();
  await peer.click({ timeout: 20_000 });
  await page.waitForTimeout(2_500);
};

export const assertShellReady = async (
  page: Page,
  accountLabel: string,
): Promise<boolean> => {
  await applyOperatorDevBundle(page);
  if (await isAppShellUnlocked(page)) {
    return true;
  }
  throw new Error(
    `${accountLabel} shell is locked on CDP. Unlock ${accountLabel} in that window, then re-run pnpm verify:u6-l3.`,
  );
};

export const evaluateInviteMatrix = (
  inviterCards: ReadonlyArray<U6L3InviteCardSnapshot>,
  inviteeCards: ReadonlyArray<U6L3InviteCardSnapshot>,
): Readonly<{
  inviterCancelOnly: boolean;
  inviteeAcceptDecline: boolean;
  pass: boolean;
  blockedReason: string | null;
}> => {
  const inviterCancelOnly = inviterCards.some((card) => (
    card.lifecycle === "active"
    && card.role === "inviter"
    && card.hasCancel
    && !card.hasAccept
    && !card.hasDecline
  ));
  const inviteeAcceptDecline = inviteeCards.some((card) => (
    card.lifecycle === "active"
    && card.role === "invitee"
    && card.hasAccept
    && card.hasDecline
    && !card.hasCancel
  ));
  const pass = inviterCancelOnly && inviteeAcceptDecline;
  let blockedReason: string | null = null;
  if (!pass) {
    if (!inviterCancelOnly && !inviteeAcceptDecline) {
      blockedReason = "active_invite_cards_missing_both_sides";
    } else if (!inviterCancelOnly) {
      blockedReason = "inviter_cancel_affordance_missing";
    } else {
      blockedReason = "invitee_accept_decline_affordance_missing";
    }
  }
  return { inviterCancelOnly, inviteeAcceptDecline, pass, blockedReason };
};

export const writeU6L3Report = (report: U6L3Report): void => {
  fs.mkdirSync(path.dirname(U6_L3_REPORT_PATH), { recursive: true });
  fs.writeFileSync(U6_L3_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
};

export const U6_L3_ACCOUNTS = {
  inviter: TESTER1,
  invitee: TESTER2,
} as const;
