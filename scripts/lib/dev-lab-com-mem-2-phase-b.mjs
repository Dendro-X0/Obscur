/**
 * COM-MEM-2 R6 phase B — automate manual steps 2–4 (create → invite DM → accept join).
 *
 * Best-effort Playwright UI flow; individual steps report pass/fail. Requires full-stack
 * dev profile (see applyComMem2FullStackBundle) and pnpm dev:desktop:online stack.
 */

import { applyComMem2FullStackBundle, ensureDevLabAccountUnlocked } from "./dev-lab-playwright-auth.mjs";
import { clickSidebarLink, waitForDevLab, waitForMessagingReady } from "./dev-lab-playwright-shared.mjs";

export const COM_MEM_2_WORKSPACE_PREFIX = "NewTest";

/** @param {Array<Record<string, unknown>>} steps */
function pushStep(steps, id, passed, message, context = undefined) {
  steps.push({ id, passed, message, durationMs: 0, context });
}

/**
 * Static shell reloads drop dev-lab unlock state — re-apply bundle + unlock after navigation.
 * @param {import('playwright').Page} page
 * @param {string} targetPath
 * @param {"tester1" | "tester2"} accountId
 * @param {{ log?: (msg: string) => void; quick?: boolean }} [options]
 */
async function navigateAuthenticated(page, targetPath, accountId, options = {}) {
  const log = options.log ?? (() => undefined);
  await page.goto(targetPath, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await applyComMem2FullStackBundle(page);
  await waitForDevLab(page, 60_000);
  if (options.quick) {
    await page.evaluate(async (id) => {
      await window.obscurDevLab?.unlock(id);
    }, accountId);
    await page.waitForTimeout(1_500);
  } else {
    await ensureDevLabAccountUnlocked(page, accountId, { log, timeoutMs: 45_000 });
  }
  await page.waitForTimeout(400);
}

/**
 * Bootstrap Layer 0 for automation — seeds local peer_trust then reloads so hooks hydrate.
 * @param {import('playwright').Page} page
 * @param {string} ownerPublicKeyHex
 * @param {string} peerPublicKeyHex
 * @param {"tester1" | "tester2"} accountId
 * @param {{ log?: (msg: string) => void }} [options]
 */
async function seedPeerTrustEdge(page, ownerPublicKeyHex, peerPublicKeyHex, accountId, options = {}) {
  const seeded = await page.evaluate(({ owner, peer }) => {
    const key = `obscur.peer_trust.v1.${owner}`;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? '{"acceptedPeers":[],"mutedPeers":[]}');
      const acceptedPeers = Array.from(new Set([...(parsed.acceptedPeers ?? []), peer]));
      localStorage.setItem(key, JSON.stringify({ ...parsed, acceptedPeers }));
      return true;
    } catch {
      return false;
    }
  }, { owner: ownerPublicKeyHex, peer: peerPublicKeyHex });
  if (!seeded) {
    return false;
  }
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  await applyComMem2FullStackBundle(page);
  await waitForDevLab(page, 30_000);
  await page.evaluate(async (id) => {
    await window.obscurDevLab?.unlock(id);
  }, accountId);
  await page.waitForTimeout(1_500);
  return isTrustedConnectionOnProfile(page, peerPublicKeyHex, accountId, { ...options, quick: true });
}

/**
 * @param {import('playwright').Page} page
 */
async function switchToCommunityView(page) {
  await clickSidebarLink(page, "Chats");
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const communityBtn = buttons.find((button) => /^group$/i.test((button.textContent ?? "").trim()));
    if (communityBtn instanceof HTMLElement) {
      communityBtn.click();
      return true;
    }
    return false;
  });
  if (clicked) {
    await page.waitForTimeout(700);
  }
  return clicked;
}

/**
 * @param {import('playwright').Page} page
 */
async function openCreateGroupDialog(page) {
  await switchToCommunityView(page);
  const newGroupButton = page.getByRole("button", { name: /new group/i });
  if (await newGroupButton.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await newGroupButton.click();
    await page.waitForTimeout(500);
    return true;
  }
  const plusClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button[aria-label]'));
    const match = buttons.find((button) => /new group/i.test(button.getAttribute("aria-label") ?? ""));
    if (match instanceof HTMLElement) {
      match.click();
      return true;
    }
    return false;
  });
  if (plusClicked) {
    await page.waitForTimeout(500);
  }
  return plusClicked;
}

/**
 * @param {import('playwright').Page} page
 * @param {string} workspaceName
 */
async function fillAndSubmitCreateGroup(page, workspaceName) {
  const nameInput = page.locator("#group-name");
  await nameInput.waitFor({ state: "visible", timeout: 15_000 });
  await nameInput.fill(workspaceName);

  const hostInput = page.locator("#group-host");
  if (await hostInput.isVisible().catch(() => false)) {
    const hostValue = await hostInput.inputValue();
    if (!hostValue.includes("7000")) {
      await hostInput.fill("localhost:7000");
    }
  }

  await page.waitForTimeout(2_500);

  const blocked = await page.locator('[data-testid="create-group-workspace-blocked"]').isVisible().catch(() => false);
  if (blocked) {
    return { submitted: false, reason: "create_blocked_banner" };
  }
  const deferred = await page.locator('[data-testid="create-group-workspace-kernel-deferred"]').isVisible().catch(() => false);
  if (deferred) {
    return { submitted: false, reason: "workspace_kernel_deferred" };
  }

  const createButton = page.getByRole("button", { name: /^create group$/i });
  const enabled = await createButton.isEnabled().catch(() => false);
  if (!enabled) {
    return { submitted: false, reason: "create_button_disabled" };
  }

  await createButton.click();
  const waitRing = page.locator('[data-testid="create-group-wait-ring"]');
  const sawWaitRing = await waitRing.isVisible({ timeout: 5_000 }).catch(() => false);
  if (sawWaitRing) {
    await waitRing.waitFor({ state: "hidden", timeout: 45_000 }).catch(() => undefined);
  } else {
    await page.waitForTimeout(3_000);
  }

  return { submitted: true, reason: "create_submitted" };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} peerPublicKeyHex
 * @param {"tester1" | "tester2"} actorId
 * @param {{ log?: (msg: string) => void }} [options]
 */
async function isTrustedConnectionOnProfile(page, peerPublicKeyHex, actorId, options = {}) {
  await navigateAuthenticated(page, `/network/${peerPublicKeyHex}`, actorId, { ...options, quick: true });
  return page.getByText(/trusted connection/i).isVisible({ timeout: 12_000 }).catch(() => false);
}

/**
 * @param {import('playwright').Page} page
 * @param {string} peerPublicKeyHex
 * @param {"tester1" | "tester2"} actorId
 * @param {{ log?: (msg: string) => void }} [options]
 */
async function sendConnectionInvitation(page, peerPublicKeyHex, actorId, options = {}) {
  await navigateAuthenticated(page, `/network/${peerPublicKeyHex}`, actorId, { ...options, quick: true });

  const alreadyTrusted = await page.getByText(/trusted connection/i).isVisible().catch(() => false);
  if (alreadyTrusted) {
    return { ok: true, reason: "already_trusted" };
  }

  const connectButton = page.getByRole("button", { name: /^(connect|resend)$/i }).first();
  if (!(await connectButton.isVisible({ timeout: 8_000 }).catch(() => false))) {
    return { ok: false, reason: "connect_button_missing" };
  }
  await connectButton.click();

  const sendInvite = page.getByRole("button", { name: /send invitation/i });
  if (await sendInvite.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await sendInvite.click();
    await page.waitForTimeout(3_000);
    return { ok: true, reason: "invitation_sent" };
  }

  return { ok: false, reason: "invitation_composer_missing" };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} creatorPublicKeyHex
 * @param {{ log?: (msg: string) => void }} [options]
 */
async function acceptIncomingConnectionRequest(page, creatorPublicKeyHex, options = {}) {
  await navigateAuthenticated(page, "/", "tester2", { ...options, quick: true });
  const requestsTabClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const requestsBtn = buttons.find((button) => /^requests$/i.test((button.textContent ?? "").trim()));
    if (requestsBtn instanceof HTMLElement) {
      requestsBtn.click();
      return true;
    }
    return false;
  });
  if (!requestsTabClicked) {
    return { ok: false, reason: "requests_tab_missing" };
  }
  await page.waitForTimeout(1_500);

  const acceptButton = page.getByRole("button", { name: /^accept$/i }).first();
  if (await acceptButton.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await acceptButton.click();
    await page.waitForTimeout(3_000);
    return { ok: true, reason: "request_accepted_ui" };
  }

  const trusted = await isTrustedConnectionOnProfile(page, creatorPublicKeyHex, "tester2", options);
  return trusted
    ? { ok: true, reason: "already_trusted_after_check" }
    : { ok: false, reason: "no_pending_request" };
}

/**
 * @param {import('playwright').Page} page
 * @param {string} joinerPublicKeyHex
 * @param {string} workspaceName
 * @param {{ log?: (msg: string) => void }} [options]
 */
async function inviteJoinerViaNetworkProfile(page, joinerPublicKeyHex, workspaceName, options = {}) {
  await navigateAuthenticated(page, `/network/${joinerPublicKeyHex}`, "tester1", { ...options, quick: true });

  const trusted = await page.getByText(/trusted connection/i).isVisible().catch(() => false);
  if (!trusted) {
    return { ok: false, reason: "joiner_not_trusted" };
  }

  const inviteButton = page.getByRole("button", { name: /^invite$/i }).first();
  if (!(await inviteButton.isVisible({ timeout: 10_000 }).catch(() => false))) {
    return { ok: false, reason: "invite_button_missing" };
  }
  await inviteButton.click();
  await page.waitForTimeout(800);

  const groupButton = page.getByRole("button").filter({ hasText: workspaceName }).first();
  if (!(await groupButton.isVisible({ timeout: 12_000 }).catch(() => false))) {
    return { ok: false, reason: "workspace_not_in_invite_list" };
  }
  await groupButton.click();
  await page.waitForTimeout(4_000);
  return { ok: true, reason: "invite_dispatched" };
}

/**
 * @param {import('playwright').Page} page
 * @param {{ log?: (msg: string) => void }} [options]
 */
async function acceptIncomingCommunityInvite(page, options = {}) {
  await navigateAuthenticated(page, "/", "tester2", { ...options, quick: true });
  const opened = await page.evaluate(async () => {
    if (typeof window.obscurDevLab?.openDmChatContainingText !== "function") {
      return { opened: false, reason: "dev_lab_open_dm_missing" };
    }
    const result = await window.obscurDevLab.openDmChatContainingText("invite");
    return { opened: result?.opened === true, pathname: result?.pathname ?? null };
  });
  if (!opened.opened) {
    await clickSidebarLink(page, "Chats");
    await page.waitForTimeout(1_000);
  }

  const inviteCard = page.locator(
    '[data-testid="community-invite-card"][data-invite-direction="incoming"][data-invite-lifecycle="active"]',
  );
  const visible = await inviteCard.first().isVisible({ timeout: 15_000 }).catch(() => false);
  if (!visible) {
    return { ok: false, reason: "incoming_invite_card_missing" };
  }

  const acceptButton = inviteCard.first().getByRole("button", { name: /^accept$/i });
  if (!(await acceptButton.isVisible().catch(() => false))) {
    return { ok: false, reason: "accept_button_missing" };
  }
  await acceptButton.click();
  await page.waitForTimeout(6_000);

  const accepted = await page.locator(
    '[data-testid="community-invite-card"][data-invite-status="accepted"]',
  ).first().isVisible({ timeout: 15_000 }).catch(() => false);

  return accepted
    ? { ok: true, reason: "invite_accepted" }
    : { ok: false, reason: "invite_accept_not_confirmed" };
}

/**
 * @param {Readonly<{
 *   pageCreator: import('playwright').Page;
 *   pageJoiner: import('playwright').Page;
 *   steps: Array<Record<string, unknown>>;
 *   log?: (msg: string) => void;
 *   creatorPublicKeyHex: string;
 *   joinerPublicKeyHex: string;
 *   workspaceName?: string;
 * }>} deps
 */
export async function runComMem2PhaseBSteps(deps) {
  const log = deps.log ?? (() => undefined);
  const workspaceName = deps.workspaceName ?? `${COM_MEM_2_WORKSPACE_PREFIX} ${Date.now()}`;
  const { pageCreator, pageJoiner, steps, creatorPublicKeyHex, joinerPublicKeyHex } = deps;

  log("COM-MEM-2 phase B: waiting for messaging bridge");
  const creatorMessagingReady = await waitForMessagingReady(pageCreator, 90_000).then(() => true).catch(() => false);
  const joinerMessagingReady = await waitForMessagingReady(pageJoiner, 90_000).then(() => true).catch(() => false);
  pushStep(
    steps,
    "phase_b_messaging_ready",
    creatorMessagingReady && joinerMessagingReady,
    creatorMessagingReady && joinerMessagingReady
      ? "Both actors messaging bridge ready."
      : `Messaging bridge not ready (creator=${creatorMessagingReady}, joiner=${joinerMessagingReady}).`,
    { creatorMessagingReady, joinerMessagingReady },
  );
  if (!creatorMessagingReady || !joinerMessagingReady) {
    return { workspaceName, layer0Ok: false, createOk: false, inviteOk: false, acceptOk: false };
  }

  log("COM-MEM-2 phase B: Layer 0 social edge (connection)");
  let layer0Ok = await seedPeerTrustEdge(pageCreator, creatorPublicKeyHex, joinerPublicKeyHex, "tester1", { log });
  if (!layer0Ok) {
    layer0Ok = await isTrustedConnectionOnProfile(pageCreator, joinerPublicKeyHex, "tester1", { log });
  }
  if (!layer0Ok) {
    const sent = await sendConnectionInvitation(pageCreator, joinerPublicKeyHex, "tester1", { log });
    if (sent.ok) {
      const accepted = await acceptIncomingConnectionRequest(pageJoiner, creatorPublicKeyHex, { log });
      layer0Ok = accepted.ok || await isTrustedConnectionOnProfile(pageCreator, joinerPublicKeyHex, "tester1", { log });
      pushStep(
        steps,
        "phase_b_layer0_connection",
        layer0Ok,
        layer0Ok
          ? `Social edge established (${sent.reason} → ${accepted.reason}).`
          : `Social edge failed: sent=${sent.reason}, accept=${accepted.reason}.`,
        { sent, accepted },
      );
    } else {
      pushStep(
        steps,
        "phase_b_layer0_connection",
        false,
        `Could not send connection invitation: ${sent.reason}.`,
        { sent },
      );
    }
  } else {
    pushStep(steps, "phase_b_layer0_connection", true, "Trusted connection already present.", {});
  }

  log(`COM-MEM-2 phase B: create managed workspace "${workspaceName}"`);
  await navigateAuthenticated(pageCreator, "/", "tester1", { log, quick: true });
  const dialogOpened = await openCreateGroupDialog(pageCreator);
  let createOk = false;
  let createContext = { dialogOpened, reason: "dialog_not_opened" };
  if (dialogOpened) {
    const createResult = await fillAndSubmitCreateGroup(pageCreator, workspaceName);
    createOk = createResult.submitted === true;
    createContext = { dialogOpened, ...createResult };
  }
  pushStep(
    steps,
    "phase_b_step2_create_workspace",
    createOk,
    createOk
      ? `Managed workspace "${workspaceName}" created.`
      : `Create workspace failed (${createContext.reason ?? "unknown"}).`,
    createContext,
  );

  log("COM-MEM-2 phase B: invite joiner via connection DM");
  let inviteOk = false;
  let inviteContext = { reason: "skipped_prereq" };
  if (!createOk) {
    inviteContext = { reason: "skipped_create_failed" };
  } else if (!layer0Ok) {
    inviteContext = { reason: "skipped_layer0_failed" };
  } else {
    const inviteResult = await inviteJoinerViaNetworkProfile(pageCreator, joinerPublicKeyHex, workspaceName, { log });
    inviteOk = inviteResult.ok;
    inviteContext = inviteResult;
  }
  pushStep(
    steps,
    "phase_b_step3_invite_dm",
    inviteOk,
    inviteOk
      ? `Invite dispatched via connection DM (${inviteContext.reason}).`
      : `Invite via DM failed (${inviteContext.reason ?? "unknown"}).`,
    inviteContext,
  );

  log("COM-MEM-2 phase B: joiner accepts invite");
  let acceptOk = false;
  let acceptContext = { reason: "skipped_invite_failed" };
  if (inviteOk) {
    const acceptResult = await acceptIncomingCommunityInvite(pageJoiner, { log });
    acceptOk = acceptResult.ok;
    acceptContext = acceptResult;
  }
  pushStep(
    steps,
    "phase_b_step4_accept_join",
    acceptOk,
    acceptOk
      ? `Joiner accepted invite (${acceptContext.reason}).`
      : `Join accept failed (${acceptContext.reason ?? "unknown"}).`,
    acceptContext,
  );

  return { workspaceName, layer0Ok, createOk, inviteOk, acceptOk };
}
