import type { Page } from "@playwright/test";
import {
  assertSliceCL3Tester1Identity,
  readSliceCL3LedgerSnapshot,
  readU4L3MembershipEntry,
  SLICE_C_L3_GROUP_ID,
  SLICE_C_L3_GROUP_NAME,
  SLICE_C_L3_RELAY_URL,
  writeSliceCL3Report,
} from "./u4-l3-leave-fixture";

export {
  assertSliceCL3Tester1Identity,
  readSliceCL3LedgerSnapshot,
  readU4L3MembershipEntry,
  SLICE_C_L3_GROUP_ID,
  SLICE_C_L3_GROUP_NAME,
  SLICE_C_L3_RELAY_URL,
  writeSliceCL3Report,
};

export const NEWTEST2_JOIN_URI = `${SLICE_C_L3_GROUP_ID}@${SLICE_C_L3_RELAY_URL}` as const;

export const clearNewTest2Tombstone = async (
  page: Page,
  params: Readonly<{ publicKeyHex: string; groupId?: string; relayUrl?: string }>,
): Promise<number> => (
  page.evaluate(({ publicKeyHex, groupId, relayUrl }) => {
    const prefix = "obscur.group.tombstones.v1";
    const target = `${groupId}@@${relayUrl}`;
    let removed = 0;
    for (const key of Object.keys(localStorage)) {
      if (!key.includes(prefix)) {
        continue;
      }
      if (!key.includes(publicKeyHex) && !key.endsWith(`.${publicKeyHex}`)) {
        // keep scanning — scoped keys embed pubkey
      }
      try {
        const raw = localStorage.getItem(key);
        if (!raw) {
          continue;
        }
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          continue;
        }
        const next = parsed.filter((entry) => {
          if (typeof entry !== "string") {
            return true;
          }
          const keep = !entry.includes(groupId);
          if (!keep) {
            removed += 1;
          }
          return keep;
        });
        if (next.length !== parsed.length) {
          localStorage.setItem(key, JSON.stringify(next));
        }
      } catch {
        // ignore
      }
    }
    // Also clear leave outbox rows for this group (durable leave gate).
    for (const key of Object.keys(localStorage)) {
      if (!key.includes("obscur.group.leave_outbox.v1")) {
        continue;
      }
      try {
        const raw = localStorage.getItem(key);
        if (!raw) {
          continue;
        }
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          continue;
        }
        const next = parsed.filter((entry) => {
          if (!entry || typeof entry !== "object") {
            return true;
          }
          const row = entry as { groupId?: string };
          return row.groupId?.trim() !== groupId;
        });
        if (next.length !== parsed.length) {
          localStorage.setItem(key, JSON.stringify(next));
        }
      } catch {
        // ignore
      }
    }
    void target;
    return removed;
  }, {
    publicKeyHex: params.publicKeyHex,
    groupId: params.groupId ?? SLICE_C_L3_GROUP_ID,
    relayUrl: params.relayUrl ?? SLICE_C_L3_RELAY_URL,
  })
);

/**
 * Force NewTest 2 to `joined` in every membership ledger snapshot (scoped + legacy).
 * Needed when a running shell still merges stale legacy `left` over a fresh rejoin.
 */
export const forcePersistNewTest2JoinedLedger = async (
  page: Page,
  params: Readonly<{
    groupId?: string;
    relayUrl?: string;
    communityId?: string;
  }> = {},
): Promise<number> => (
  page.evaluate(({ groupId, relayUrl, communityId }) => {
    const now = Date.now();
    let updatedKeys = 0;
    for (const key of Object.keys(localStorage)) {
      if (!key.includes("obscur.group.membership_ledger.v1")) {
        continue;
      }
      try {
        const raw = localStorage.getItem(key);
        if (!raw) {
          continue;
        }
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          continue;
        }
        let changed = false;
        const next = parsed.map((entry) => {
          if (!entry || typeof entry !== "object") {
            return entry;
          }
          const row = entry as Record<string, unknown>;
          if (String(row.groupId ?? "").trim() !== groupId) {
            return entry;
          }
          changed = true;
          return {
            ...row,
            status: "joined",
            relayUrl: typeof row.relayUrl === "string" && row.relayUrl.trim().length > 0
              ? row.relayUrl
              : relayUrl,
            communityId: typeof row.communityId === "string" && row.communityId.trim().length > 0
              ? row.communityId
              : communityId,
            updatedAtUnixMs: now,
            updatedAt: now,
          };
        });
        const hasGroup = next.some((entry) => (
          entry && typeof entry === "object"
          && String((entry as { groupId?: string }).groupId ?? "").trim() === groupId
        ));
        if (!hasGroup) {
          next.push({
            groupId,
            relayUrl,
            communityId,
            status: "joined",
            updatedAtUnixMs: now,
            updatedAt: now,
            createdAt: now,
            displayName: "NewTest 2",
            ledgerVersion: 2,
          });
          changed = true;
        }
        if (changed) {
          localStorage.setItem(key, JSON.stringify(next));
          updatedKeys += 1;
        }
      } catch {
        // ignore
      }
    }
    return updatedKeys;
  }, {
    groupId: params.groupId ?? SLICE_C_L3_GROUP_ID,
    relayUrl: params.relayUrl ?? SLICE_C_L3_RELAY_URL,
    communityId: params.communityId
      ?? `${params.groupId ?? SLICE_C_L3_GROUP_ID}:${params.relayUrl ?? SLICE_C_L3_RELAY_URL}`,
  })
);

export const injectNewTest2RoomKey = async (
  page: Page,
  roomKeyHex: string,
  groupId = SLICE_C_L3_GROUP_ID,
): Promise<boolean> => (
  page.evaluate(({ targetGroupId, hex }) => {
    const profileScope = localStorage.getItem("obscur.profile.active.v1")
      ?? localStorage.getItem("obscur.profile.active")
      ?? "default";
    const storageKey = `obscur:room-keys:v1:${profileScope}`;
    // roomKeyStore.readPersistedMap requires record.groupId — bare { roomKeyHex } is ignored.
    type RoomKeyRecord = { groupId: string; roomKeyHex: string; createdAt: number; previousKeys?: string[] };
    let map: Record<string, RoomKeyRecord> = {};
    try {
      const raw = localStorage.getItem(storageKey) ?? localStorage.getItem("obscur:room-keys:v1:default");
      if (raw) {
        map = JSON.parse(raw) as Record<string, RoomKeyRecord>;
      }
    } catch {
      map = {};
    }
    map[targetGroupId] = {
      groupId: targetGroupId,
      roomKeyHex: hex,
      createdAt: Date.now(),
      previousKeys: map[targetGroupId]?.previousKeys ?? [],
    };
    localStorage.setItem(storageKey, JSON.stringify(map));
    // Dev escape: skip Nostr relay join evidence for fixture rejoin (coord already active).
    localStorage.setItem("obscur.dev.coordination_only_workspace.v1", "1");
    return true;
  }, { targetGroupId: groupId, hex: roomKeyHex.trim().toLowerCase() })
);

export const openNetworkJoinDialog = async (page: Page): Promise<void> => {
  const networkLink = page.getByRole("link", { name: "Network", exact: true });
  if (await networkLink.isVisible().catch(() => false)) {
    await networkLink.click();
    await page.waitForLoadState("domcontentloaded");
  } else {
    await page.evaluate(() => {
      window.location.assign(`${window.location.origin}/network`);
    });
    await page.waitForLoadState("domcontentloaded");
  }
  await page.waitForTimeout(1500);

  const joinButton = page.getByRole("button", { name: /^join$/i }).first();
  await joinButton.waitFor({ state: "visible", timeout: 60_000 });
  await joinButton.click();
};

export const submitNewTest2JoinUri = async (page: Page, joinUri = NEWTEST2_JOIN_URI): Promise<void> => {
  const input = page.getByLabel(/group address/i).or(page.getByPlaceholder(/groupId@|my-group@/i)).first();
  await input.waitFor({ state: "visible", timeout: 60_000 });
  await input.click({ clickCount: 3 });
  await input.fill("");
  await input.fill(joinUri);
  const filled = await input.inputValue();
  if (filled.trim() !== joinUri) {
    await input.pressSequentially(joinUri, { delay: 5 });
  }
  const check = page.getByRole("button", { name: /check community/i });
  await check.waitFor({ state: "visible", timeout: 30_000 });
  await check.click();
  await page.waitForTimeout(1500);

  const confirmJoin = page.getByRole("button", { name: /^join community$/i }).last();
  await confirmJoin.waitFor({ state: "visible", timeout: 60_000 });
  await confirmJoin.click();
  // Do not key off "Join Community" visibility — label becomes "Sending Request..." mid-join.
  const previewHeading = page.getByRole("heading", { name: /^join /i });
  const closed = previewHeading.waitFor({ state: "hidden", timeout: 60_000 });
  const failed = page.locator(".text-destructive, [class*='destructive']").filter({
    hasText: /./,
  }).first().waitFor({ state: "visible", timeout: 60_000 }).then(async () => {
    const message = (await page.locator(".text-destructive, [class*='destructive']").first().textContent())?.trim()
      || "join_error";
    throw new Error(`Join dialog reported failure: ${message}`);
  });
  await Promise.race([closed, failed]);
};
